import jwt
import stripe
from django.conf import settings
from django.utils import timezone
from rest_framework import permissions
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.cookies import MOBILE, client_platform
from accounts.models import User
from common.monetization import (
    CREDIT_BUNDLES,
    CREDIT_UNITS_PER_CREDIT,
    CURRENCY,
    CURRENCY_NAME,
    PURCHASE_BLOCKED_COUNTRIES,
    SUBSCRIPTION_BONUS_CREDITS,
    SUBSCRIPTION_BONUS_PACKS,
    SUBSCRIPTION_PRICE_CENTS,
)

from . import play
from . import stripe as payments
from .actions import BillingError, PaymentMismatch, active_period, publishing_summary
from .models import BillingReview, Checkout, MembershipSettings, StarBalance, StripeCustomer
from .serializers import CheckoutSerializer, MembershipSettingsSerializer, PlayPurchaseSerializer
from .stats import creator_stats


class MembershipView(APIView):
    def get(self, request: Request) -> Response:
        assert isinstance(request.user, User)
        period = active_period(request.user) if settings.MONETIZATION_ENABLED else None
        return Response(
            {
                "enabled": settings.MONETIZATION_ENABLED,
                "preview": settings.DEBUG and settings.MONETIZATION_PREVIEW,
                "currency_name": CURRENCY_NAME,
                "star_units": StarBalance.objects.filter(user=request.user)
                .values_list("units", flat=True)
                .first()
                or 0,
                "units_per_star": CREDIT_UNITS_PER_CREDIT,
                "show_badge": not MembershipSettings.objects.filter(
                    user=request.user, show_badge=False
                ).exists(),
                "pending_checkouts": [
                    {"product": checkout.product, "request_key": str(checkout.request_key)}
                    for checkout in Checkout.objects.filter(
                        user=request.user, completed=False, expires_at__gt=timezone.now()
                    ).order_by("-created_at")[:20]
                ],
                "subscription": {
                    "checkout_available": payments.checkout_ready("subscription")
                    and period is None,
                    "management_available": payments.configured()
                    and bool(settings.STRIPE_PORTAL_CONFIGURATION)
                    and StripeCustomer.objects.filter(user=request.user).exists(),
                    "active": period is not None,
                    "provider": period.subscription.provider if period else None,
                    "paid_through": period.ends_at if period else None,
                    "auto_renews": period.subscription.auto_renews if period else False,
                    "bonus_packs_remaining": period.bonus_packs_remaining if period else 0,
                    "price_cents": SUBSCRIPTION_PRICE_CENTS,
                    "currency": CURRENCY,
                    "monthly_bonus_packs": SUBSCRIPTION_BONUS_PACKS,
                    "monthly_stars": SUBSCRIPTION_BONUS_CREDITS,
                },
                "publishing": publishing_summary(request.user),
                "blocked_countries": sorted(PURCHASE_BLOCKED_COUNTRIES),
                "play": {
                    "available": play.configured() and request.user.email_verified,
                    "subscription_id": settings.PLAY_SUBSCRIPTION_ID,
                    "account_id": play.account_id(request.user) if play.configured() else None,
                },
                "bundles": [
                    {
                        "id": key,
                        "price_cents": bundle.price_cents,
                        "currency": CURRENCY,
                        "base_stars": bundle.base_credits,
                        "bonus_stars": bundle.bonus_credits,
                        "total_stars": bundle.total_credits,
                        "checkout_available": payments.checkout_ready(key),
                    }
                    for key, bundle in CREDIT_BUNDLES.items()
                ],
            }
        )

    def patch(self, request: Request) -> Response:
        assert isinstance(request.user, User)
        serializer = MembershipSettingsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        MembershipSettings.objects.update_or_create(
            user=request.user, defaults=serializer.validated_data
        )
        return self.get(request)


class CreatorStatsView(APIView):
    def get(self, request: Request) -> Response:
        assert isinstance(request.user, User)
        return Response(creator_stats(request.user))


class CheckoutView(APIView):
    throttle_scope = "billing"

    def post(self, request: Request) -> Response:
        assert isinstance(request.user, User)
        if request.headers.get("X-Client-Platform") != "web":
            raise ValidationError("Use your platform's store for purchases.")
        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            return Response(payments.create_checkout(request.user, **serializer.validated_data))
        except BillingError as exc:
            raise ValidationError(str(exc)) from exc
        except stripe.StripeError:
            return Response({"error": "Checkout could not open. Please try again."}, status=503)


class PortalView(APIView):
    throttle_scope = "billing"

    def post(self, request: Request) -> Response:
        assert isinstance(request.user, User)
        if request.headers.get("X-Client-Platform") != "web":
            raise ValidationError("Use your platform's store to manage purchases.")
        try:
            return Response(payments.portal(request.user))
        except BillingError as exc:
            raise ValidationError(str(exc)) from exc
        except stripe.StripeError:
            return Response(
                {"error": "Subscription management could not open. Please try again."}, status=503
            )


class StripeWebhookView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    throttle_classes = []

    def post(self, request: Request) -> Response:
        payload = request.body
        if len(payload) > 1_000_000:
            return Response(status=413)
        try:
            event = payments.verify_event(payload, request.headers.get("Stripe-Signature", ""))
        except (ValueError, stripe.SignatureVerificationError):
            return Response(status=400)
        except BillingError:
            return Response(status=503)
        try:
            payments.process_event(event)
        except (BillingError, stripe.StripeError):
            return Response(status=503)
        return Response(status=204)


class PlayPurchaseView(APIView):
    throttle_scope = "billing"

    def post(self, request: Request) -> Response:
        assert isinstance(request.user, User)
        if client_platform(request) != MOBILE:
            raise ValidationError("Google Play purchases come from the Android app.")
        serializer = PlayPurchaseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = serializer.validated_data["product"]
        token = serializer.validated_data["purchase_token"]
        try:
            if product == "subscription":
                result = play.verify_subscription(request.user, token)
            else:
                result = play.verify_product(request.user, product, token)
        except play.PlayUnavailable as exc:
            return Response({"error": str(exc)}, status=503)
        except play.NeedsReview as exc:
            BillingReview.objects.get_or_create(
                provider="play", payment_reference=token, reason="payment_mismatch"
            )
            raise ValidationError(
                "We couldn't add this purchase automatically, so it's been flagged for a person "
                "to check."
            ) from exc
        except BillingError as exc:
            raise ValidationError(str(exc)) from exc
        return Response({"status": result})


class PlayNotificationView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    throttle_classes = []

    def post(self, request: Request) -> Response:
        try:
            play.verify_push(request.headers.get("Authorization", ""))
        except jwt.PyJWTError:
            return Response(status=401)
        if not play.configured():
            return Response(status=503)
        try:
            if not isinstance(request.data, dict):
                return Response(status=204)
            play.handle_push(request.data)
        except PaymentMismatch:
            # Nothing a retry could fix; acknowledge so Pub/Sub stops sending it.
            return Response(status=204)
        except BillingError:
            return Response(status=503)
        return Response(status=204)
