from datetime import UTC, datetime, timedelta
from urllib.parse import urlparse
from uuid import UUID

import stripe
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from accounts.models import User
from common.monetization import (
    CREDIT_BUNDLES,
    CURRENCY,
    PURCHASE_BLOCKED_COUNTRIES,
    SUBSCRIPTION_PRICE_CENTS,
)

from . import actions
from .models import (
    BillingReview,
    Checkout,
    StarGrant,
    StripeCustomer,
    StripeEvent,
    Subscription,
    SubscriptionPeriod,
)

HANDLED_EVENTS = {
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.expired",
    "invoice.paid",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "charge.refunded",
    "charge.dispute.created",
    "charge.dispute.closed",
}


def configured() -> bool:
    key = settings.STRIPE_SECRET_KEY
    return bool(
        key
        and settings.STRIPE_WEBHOOK_SECRET
        and (
            key.startswith("sk_test_")
            or (key.startswith("sk_live_") and settings.STRIPE_LIVE_APPROVED)
        )
    )


def checkout_ready(product: str) -> bool:
    return bool(
        settings.MONETIZATION_ENABLED
        and settings.STRIPE_CHECKOUT_ENABLED
        and configured()
        and isinstance(settings.STRIPE_PRICE_IDS, dict)
        and settings.STRIPE_PRICE_IDS.get(product)
    )


def client() -> stripe.StripeClient:
    if not configured():
        raise actions.BillingError("Payments are not available yet.")
    return stripe.StripeClient(
        settings.STRIPE_SECRET_KEY,
        http_client=stripe.RequestsClient(timeout=10),
        max_network_retries=1,
    )


def reference(value) -> str:
    return value.get("id", "") if isinstance(value, dict) else value or ""


def _return_url() -> str:
    url = settings.STRIPE_RETURN_URL
    parsed = urlparse(url)
    if (
        parsed.scheme != "https"
        or not parsed.netloc
        or parsed.username
        or parsed.query
        or parsed.fragment
    ):
        raise actions.BillingError("Payment return address is not configured.")
    return url


def _price(product: str) -> int:
    if product == "subscription":
        return SUBSCRIPTION_PRICE_CENTS
    bundle = CREDIT_BUNDLES.get(product)
    if bundle is None:
        raise actions.BillingError("Unknown ticket bundle.")
    return bundle.price_cents


def _validate_price(price, product: str, amount: int) -> None:
    recurring = price.get("recurring")
    if (
        price.get("currency") != CURRENCY.lower()
        or price.get("unit_amount") != amount
        or not price.get("active")
        or (product != "subscription" and recurring)
        or (
            product == "subscription"
            and (
                not recurring
                or recurring.get("interval") != "month"
                or recurring.get("interval_count") != 1
            )
        )
    ):
        raise actions.BillingError("Payment pricing does not match the offer.")


@transaction.atomic
def _prepare_checkout(user: User, product: str, request_key: UUID) -> Checkout:
    amount = _price(product)
    if not checkout_ready(product):
        raise actions.BillingError("Purchases are not available yet.")
    prices = settings.STRIPE_PRICE_IDS
    if not isinstance(prices, dict):
        raise actions.BillingError("Payment pricing is not configured.")
    locked = actions.lock_accounts([user.pk])[user.pk]
    if not locked.is_active or not locked.email_verified:
        raise actions.BillingError("Verify your email before purchasing.")
    checkout = Checkout.objects.filter(user=locked, request_key=request_key).first()
    if checkout:
        if checkout.product != product:
            raise actions.BillingError("That request belongs to a different purchase.")
        if checkout.completed or not checkout.expires_at or checkout.expires_at <= timezone.now():
            raise actions.BillingError("That checkout has ended. Refresh your membership.")
        return checkout
    if product == "subscription":
        if SubscriptionPeriod.objects.filter(
            subscription__user=locked, ends_at__gt=timezone.now()
        ).exists():
            raise actions.BillingError("You already have a paid subscription. Manage it instead.")
        if Checkout.objects.filter(
            user=locked, product=product, completed=False, expires_at__gt=timezone.now()
        ).exists():
            raise actions.BillingError("You already have a subscription checkout open.")
    return Checkout.objects.create(
        user=locked,
        request_key=request_key,
        product=product,
        price_reference=prices[product],
        price_cents=amount,
        expires_at=datetime.fromtimestamp(
            int((timezone.now() + timedelta(minutes=35)).timestamp()), UTC
        ),
    )


def create_checkout(user: User, product: str, request_key: UUID) -> dict:
    # Persist intent first so ambiguous network failures reuse identical parameters.
    checkout = _prepare_checkout(user, product, request_key)
    _ensure_customer(user)
    with transaction.atomic():
        locked = actions.lock_accounts([user.pk])[user.pk]
        if not locked.is_active:
            raise actions.BillingError("This account is closed.")
        checkout.refresh_from_db()
        if checkout.completed:
            raise actions.BillingError("That checkout has ended. Refresh your membership.")
        return _checkout_session(locked, checkout)


def _checkout_session(locked: User, checkout: Checkout) -> dict:
    api = client()
    if checkout.session_reference:
        session = api.v1.checkout.sessions.retrieve(checkout.session_reference).to_dict()
        if session.get("status") != "open":
            raise actions.BillingError("That checkout has ended. Refresh your membership.")
        return {"url": session["url"], "request_key": str(checkout.request_key)}
    _validate_price(
        api.v1.prices.retrieve(checkout.price_reference).to_dict(),
        checkout.product,
        checkout.price_cents,
    )
    customer = StripeCustomer.objects.get(user=locked)
    assert checkout.expires_at is not None
    if checkout.product == "subscription":
        existing = api.v1.subscriptions.list(
            {"customer": customer.reference, "status": "all", "limit": 100}
        )
        for subscription in existing.auto_paging_iter():
            remote = subscription.to_dict()
            if (remote.get("metadata") or {}).get("miscellary_checkout") and remote.get(
                "status"
            ) not in {"canceled", "incomplete_expired"}:
                raise actions.BillingError(
                    "You already have a website subscription. Manage it instead."
                )
    metadata = {"miscellary_checkout": str(checkout.pk)}
    params: stripe.params.checkout.SessionCreateParams = {
        "customer": customer.reference,
        "client_reference_id": str(checkout.pk),
        "metadata": metadata,
        "line_items": [{"price": checkout.price_reference, "quantity": 1}],
        "mode": "subscription" if checkout.product == "subscription" else "payment",
        "managed_payments": {"enabled": settings.STRIPE_MANAGED_PAYMENTS},
        "success_url": _return_url() + "?checkout=returned",
        "cancel_url": _return_url() + "?checkout=cancelled",
        "expires_at": int(checkout.expires_at.timestamp()),
        "allow_promotion_codes": False,
    }
    if checkout.product == "subscription":
        params["subscription_data"] = {"metadata": metadata}
    session = api.v1.checkout.sessions.create(
        params,
        options={"idempotency_key": f"miscellary-checkout-{locked.pk}-{checkout.request_key}"},
    ).to_dict()
    checkout.session_reference = session["id"]
    checkout.expires_at = datetime.fromtimestamp(session["expires_at"], UTC)
    checkout.save(update_fields=["session_reference", "expires_at"])
    return {"url": session["url"], "request_key": str(checkout.request_key)}


@transaction.atomic
def _ensure_customer(user: User) -> None:
    locked = actions.lock_accounts([user.pk])[user.pk]
    if not locked.is_active:
        raise actions.BillingError("This account is closed.")
    customer = StripeCustomer.objects.filter(user=locked).first()
    if customer is None:
        remote = client().v1.customers.create(
            {"metadata": {"miscellary_user": str(locked.pk)}},
            options={"idempotency_key": f"miscellary-customer-{locked.pk}"},
        )
        StripeCustomer.objects.create(user=locked, reference=remote.id)


@transaction.atomic
def portal(user: User) -> dict:
    if not configured() or not settings.STRIPE_PORTAL_CONFIGURATION:
        raise actions.BillingError("Subscription management is not available yet.")
    locked = actions.lock_accounts([user.pk])[user.pk]
    if not locked.is_active:
        raise actions.BillingError("This account is closed.")
    customer = StripeCustomer.objects.filter(user=locked).first()
    if not customer:
        raise actions.BillingError("No website purchases are attached to this account.")
    session = client().v1.billing_portal.sessions.create(
        {
            "customer": customer.reference,
            "configuration": settings.STRIPE_PORTAL_CONFIGURATION,
            "return_url": _return_url() + "?checkout=managed",
        }
    )
    return {"url": session.url}


def cancel_for_closure(user: User) -> None:
    customer = StripeCustomer.objects.filter(user=user).first()
    if customer is None:
        return
    api = client()
    subscriptions = set(
        user.subscription_set.filter(provider="web").values_list("reference", flat=True)
    )
    checkout_ids = {
        str(pk) for pk in Checkout.objects.filter(user=user).values_list("pk", flat=True)
    }
    sessions = api.v1.checkout.sessions.list({"customer": customer.reference, "limit": 100})
    for remote_session in sessions.auto_paging_iter():
        session = remote_session.to_dict()
        if (session.get("metadata") or {}).get("miscellary_checkout") not in checkout_ids:
            continue
        if session.get("status") == "open":
            api.v1.checkout.sessions.expire(session["id"])
        elif session.get("subscription"):
            subscriptions.add(reference(session.get("subscription")))
    for subscription_id in sorted(subscriptions):
        remote = api.v1.subscriptions.retrieve(subscription_id).to_dict()
        if reference(remote.get("customer")) != customer.reference:
            raise actions.BillingError("Subscription account does not match this account.")
        if remote.get("status") not in {"canceled", "incomplete_expired"}:
            api.v1.subscriptions.cancel(subscription_id, {"invoice_now": False, "prorate": False})
    Checkout.objects.filter(user=user, completed=False).update(expires_at=timezone.now())


def _checkout_for_subscription(subscription) -> Checkout:
    key = (subscription.get("metadata") or {}).get("miscellary_checkout")
    try:
        checkout = Checkout.objects.get(pk=UUID(key), product="subscription")
    except (ValueError, TypeError, Checkout.DoesNotExist) as exc:
        raise actions.PaymentMismatch("Subscription purchase could not be matched.") from exc
    if not StripeCustomer.objects.filter(
        user=checkout.user, reference=reference(subscription.get("customer"))
    ).exists():
        raise actions.PaymentMismatch("Subscription account does not match the purchase.")
    return checkout


def _refund(api, payment_id: str, receipt: StripeEvent, payment_reference: str) -> None:
    # Refunded straight away and kept on the review list, resolved, as a record.
    if payment_id:
        api.v1.refunds.create(
            {"payment_intent": payment_id}, options={"idempotency_key": f"miscellary-{payment_id}"}
        )
    BillingReview.objects.create(
        event=receipt,
        payment_reference=payment_reference,
        reason="restricted_country" if payment_id else "restricted_country_unrefunded",
        resolved_at=timezone.now() if payment_id else None,
    )


def _fulfill_session(session_id: str, receipt: StripeEvent) -> None:
    session = client().v1.checkout.sessions.retrieve(session_id).to_dict()
    key = (session.get("metadata") or {}).get("miscellary_checkout")
    if not key:
        return
    try:
        checkout = Checkout.objects.get(pk=UUID(key))
    except (ValueError, TypeError, Checkout.DoesNotExist) as exc:
        raise actions.PaymentMismatch("Checkout could not be matched.") from exc
    locked = actions.lock_accounts([checkout.user_id])[checkout.user_id]
    checkout.refresh_from_db()
    if checkout.session_reference and checkout.session_reference != session_id:
        raise actions.PaymentMismatch("Checkout confirmation does not match the purchase.")
    if session.get("payment_status") != "paid" or session.get("status") != "complete":
        return
    if (
        session.get("client_reference_id") != str(checkout.pk)
        or session.get("currency") != CURRENCY.lower()
        or session.get("amount_subtotal") != checkout.price_cents
        or session.get("amount_total", 0) < checkout.price_cents
        or not StripeCustomer.objects.filter(
            user=checkout.user, reference=reference(session.get("customer"))
        ).exists()
    ):
        raise actions.PaymentMismatch("Checkout payment does not match the purchase.")
    if not locked.is_active:
        BillingReview.objects.create(
            event=receipt, payment_reference=session_id, reason="payment_after_closure"
        )
        return
    country = ((session.get("customer_details") or {}).get("address") or {}).get("country")
    if country in PURCHASE_BLOCKED_COUNTRIES:
        if checkout.product != "subscription":
            _refund(client(), reference(session.get("payment_intent")), receipt, session_id)
        checkout.completed = True
        checkout.session_reference = session_id
        checkout.save(update_fields=["completed", "session_reference"])
        return
    if checkout.product != "subscription":
        payment_id = reference(session.get("payment_intent"))
        if not payment_id:
            raise actions.PaymentMismatch("Payment confirmation is missing.")
        actions.grant_bundle(checkout.user, "web", f"stripe:{payment_id}", checkout.product)
    if checkout.product != "subscription":
        checkout.completed = True
    checkout.session_reference = session_id
    checkout.save(update_fields=["completed", "session_reference"])


def _fulfill_invoice(invoice_id: str, receipt: StripeEvent) -> None:
    api = client()
    invoice = api.v1.invoices.retrieve(invoice_id).to_dict()
    subscription_id = reference(
        ((invoice.get("parent") or {}).get("subscription_details") or {}).get("subscription")
    )
    if not subscription_id or invoice.get("billing_reason") not in {
        "subscription_create",
        "subscription_cycle",
    }:
        return
    subscription = api.v1.subscriptions.retrieve(subscription_id).to_dict()
    if not (subscription.get("metadata") or {}).get("miscellary_checkout"):
        return
    checkout = _checkout_for_subscription(subscription)
    locked = actions.lock_accounts([checkout.user_id])[checkout.user_id]
    subscription = api.v1.subscriptions.retrieve(subscription_id).to_dict()
    lines = api.v1.invoices.line_items.list(invoice_id, {"limit": 2}).to_dict()
    if lines.get("has_more") or len(lines["data"]) != 1:
        raise actions.PaymentMismatch("Unexpected subscription invoice items.")
    line = lines["data"][0]
    if (
        invoice.get("status") != "paid"
        or invoice.get("amount_remaining") != 0
        or invoice.get("total", 0) < checkout.price_cents
        or invoice.get("amount_paid", 0) < invoice.get("total", 0)
        or invoice.get("currency") != CURRENCY.lower()
        or reference(invoice.get("customer")) != reference(subscription.get("customer"))
        or ((line.get("pricing") or {}).get("price_details") or {}).get("price")
        != checkout.price_reference
        or line.get("quantity") != 1
        or line.get("amount") != checkout.price_cents
    ):
        raise actions.PaymentMismatch("Subscription payment does not match the offer.")
    # A later failed renewal must not suppress an earlier invoice that was actually paid.
    if subscription.get("status") not in {"active", "canceled", "past_due", "unpaid", "paused"}:
        raise actions.BillingError("Subscription payment is not settled yet.")
    if not locked.is_active:
        BillingReview.objects.create(
            event=receipt, payment_reference=invoice_id, reason="payment_after_closure"
        )
        return
    if (invoice.get("customer_address") or {}).get("country") in PURCHASE_BLOCKED_COUNTRIES:
        if subscription.get("status") not in {"canceled", "incomplete_expired"}:
            api.v1.subscriptions.cancel(subscription_id, {"invoice_now": False, "prorate": False})
        payments = api.v1.invoice_payments.list({"invoice": invoice_id, "limit": 1}).to_dict()
        payment_id = next(
            (
                reference((row.get("payment") or {}).get("payment_intent"))
                for row in payments.get("data", [])
            ),
            "",
        )
        _refund(api, payment_id, receipt, invoice_id)
        return
    period = line["period"]
    actions.grant_subscription_period(
        checkout.user,
        "web",
        f"stripe:{invoice_id}",
        subscription_id,
        datetime.fromtimestamp(period["start"], UTC),
        datetime.fromtimestamp(period["end"], UTC),
    )
    actions.set_auto_renewal(
        checkout.user,
        "web",
        subscription_id,
        not subscription.get("cancel_at_period_end") and subscription.get("status") != "canceled",
    )
    checkout.completed = True
    checkout.save(update_fields=["completed"])


def _grant_for_charge(charge: dict) -> StarGrant | None:
    payment_id = reference(charge.get("payment_intent"))
    if not payment_id:
        return None
    grant = StarGrant.objects.filter(provider="web", reference=f"stripe:{payment_id}").first()
    if grant:
        return grant
    # Subscription grants are keyed by invoice, so find the invoice this payment settled.
    payments = (
        client()
        .v1.invoice_payments.list(
            {"payment": {"type": "payment_intent", "payment_intent": payment_id}, "limit": 1}
        )
        .to_dict()
    )
    for payment in payments.get("data", []):
        invoice_id = reference(payment.get("invoice"))
        if invoice_id:
            return StarGrant.objects.filter(
                provider="web", reference=f"stripe:{invoice_id}"
            ).first()
    return None


def _refund_charge(charge_id: str, receipt: StripeEvent, *, disputed: bool, restore: bool) -> None:
    charge = client().v1.charges.retrieve(charge_id).to_dict()
    grant = _grant_for_charge(charge)
    if grant is None:
        BillingReview.objects.create(
            event=receipt, payment_reference=charge_id, reason="refund_unmatched"
        )
        return
    paid = charge.get("amount", 0)
    refunded = paid if disputed else charge.get("amount_refunded", 0)
    actions.reverse_grant(grant, refunded, paid, restore=restore)


@transaction.atomic
def process_event(event) -> None:
    if event.get("livemode") and not settings.STRIPE_LIVE_APPROVED:
        raise actions.BillingError("Live payments are not approved.")
    kind = event.get("type")
    if kind not in HANDLED_EVENTS:
        return
    receipt, created = StripeEvent.objects.get_or_create(
        reference=event["id"], defaults={"kind": kind}
    )
    if not created:
        return
    obj = event["data"]["object"]
    try:
        with transaction.atomic():
            _handle_event(kind, obj, receipt)
    except actions.PaymentMismatch:
        # Acknowledge it so Stripe stops retrying; a person decides on the refund.
        BillingReview.objects.create(
            event=receipt, payment_reference=obj["id"], reason="payment_mismatch"
        )


def _handle_event(kind: str, obj, receipt: StripeEvent) -> None:
    if kind in {"checkout.session.completed", "checkout.session.async_payment_succeeded"}:
        _fulfill_session(obj["id"], receipt)
    elif kind == "invoice.paid":
        _fulfill_invoice(obj["id"], receipt)
    elif kind == "checkout.session.expired":
        Checkout.objects.filter(session_reference=obj["id"], completed=False).update(
            expires_at=timezone.now()
        )
    elif kind in {"customer.subscription.updated", "customer.subscription.deleted"}:
        subscription = Subscription.objects.filter(provider="web", reference=obj["id"]).first()
        if subscription:
            actions.lock_accounts([subscription.user_id])
            remote = client().v1.subscriptions.retrieve(obj["id"]).to_dict()
            checkout = _checkout_for_subscription(remote)
            if checkout.user_id != subscription.user_id:
                raise actions.PaymentMismatch("Subscription account does not match the purchase.")
            actions.set_auto_renewal(
                checkout.user,
                "web",
                obj["id"],
                not remote.get("cancel_at_period_end") and remote.get("status") != "canceled",
            )
    elif kind == "charge.refunded":
        _refund_charge(obj["id"], receipt, disputed=False, restore=False)
    elif kind == "charge.dispute.created":
        # Stripe takes the money back when a dispute opens; a person still answers it.
        _refund_charge(reference(obj.get("charge")), receipt, disputed=True, restore=False)
        if not BillingReview.objects.filter(event=receipt).exists():
            BillingReview.objects.create(event=receipt, payment_reference=obj["id"], reason=kind)
    elif kind == "charge.dispute.closed":
        dispute = client().v1.disputes.retrieve(obj["id"]).to_dict()
        if dispute.get("status") == "won":
            _refund_charge(reference(dispute.get("charge")), receipt, disputed=False, restore=True)


def verify_event(payload: bytes, signature: str):
    if not configured():
        raise actions.BillingError("Payment callbacks are not configured.")
    return stripe.Webhook.construct_event(
        payload, signature, settings.STRIPE_WEBHOOK_SECRET
    ).to_dict()
