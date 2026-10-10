import base64
import hashlib
import hmac
import json
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import UTC, datetime

import jwt
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from accounts.models import User
from common.monetization import CREDIT_BUNDLES, PURCHASE_BLOCKED_COUNTRIES

from . import actions
from .models import BillingReview, StarGrant, Subscription, SubscriptionPeriod

API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications"
TOKEN_URL = "https://oauth2.googleapis.com/token"
SCOPE = "https://www.googleapis.com/auth/androidpublisher"
# Play keeps a purchase's benefits through these states; anything else grants nothing.
ENTITLED_STATES = {
    "SUBSCRIPTION_STATE_ACTIVE",
    "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
    "SUBSCRIPTION_STATE_CANCELED",
}
_keys = jwt.PyJWKClient("https://www.googleapis.com/oauth2/v3/certs", timeout=5)
_access: dict = {}
_access_lock = threading.Lock()


class PlayUnavailable(actions.BillingError):
    """Google could not be reached; the caller should retry later."""


class NeedsReview(actions.PaymentMismatch):
    """Google confirmed a paid purchase that this account can't take, so a person decides."""


def configured() -> bool:
    return bool(
        settings.MONETIZATION_ENABLED
        and settings.PLAY_BILLING_ENABLED
        and settings.PLAY_PACKAGE_NAME
        and settings.PLAY_SERVICE_ACCOUNT
    )


def account_id(user: User) -> str:
    # Play stores this with the purchase, tying it to one account without exposing the id.
    return hmac.new(
        settings.SECRET_KEY.encode(), f"play:{user.pk}".encode(), hashlib.sha256
    ).hexdigest()


def _credentials() -> dict:
    try:
        info = json.loads(settings.PLAY_SERVICE_ACCOUNT)
        if info["type"] != "service_account":
            raise ValueError
        return info
    except (ValueError, KeyError, TypeError) as exc:
        raise actions.BillingError("Google Play billing is not configured.") from exc


def _access_token() -> str:
    with _access_lock:
        if _access.get("expires", 0) > time.time() + 60:
            return _access["token"]
        info = _credentials()
        now = int(time.time())
        assertion = jwt.encode(
            {
                "iss": info["client_email"],
                "scope": SCOPE,
                "aud": TOKEN_URL,
                "iat": now,
                "exp": now + 3600,
            },
            info["private_key"],
            algorithm="RS256",
        )
        body = urllib.parse.urlencode(
            {"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": assertion}
        ).encode()
        data = _send(urllib.request.Request(TOKEN_URL, data=body, method="POST"))
        _access.update(token=data["access_token"], expires=now + int(data["expires_in"]))
        return _access["token"]


def _send(request: urllib.request.Request) -> dict:
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            raw = response.read()
    except urllib.error.HTTPError as exc:
        if exc.code in {400, 404, 410}:
            raise actions.PaymentMismatch("Google Play does not recognise that purchase.") from exc
        raise PlayUnavailable("Google Play could not be reached. Please try again.") from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise PlayUnavailable("Google Play could not be reached. Please try again.") from exc
    return json.loads(raw) if raw else {}


def call(method: str, path: str, body: dict | None = None) -> dict:
    package = urllib.parse.quote(settings.PLAY_PACKAGE_NAME, safe="")
    request = urllib.request.Request(
        f"{API}/{package}/{path}",
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={
            "Authorization": f"Bearer {_access_token()}",
            "Content-Type": "application/json",
        },
    )
    return _send(request)


def _quote(value: str) -> str:
    return urllib.parse.quote(value, safe="")


def _check_token(token) -> str:
    if not isinstance(token, str) or not 10 <= len(token) <= 255 or not token.isascii():
        raise actions.PaymentMismatch("Invalid Google Play purchase.")
    return token


def _allowed(test: bool) -> None:
    if not test and not settings.PLAY_LIVE_APPROVED:
        raise actions.BillingError("Live Google Play purchases are not approved yet.")


def _owner_matches(user: User, remote_id) -> None:
    if not isinstance(remote_id, str) or not hmac.compare_digest(remote_id, account_id(user)):
        raise actions.PaymentMismatch("That Google Play purchase belongs to another account.")


def verify_product(user: User, product: str, token: str) -> str:
    """Grant a ticket bundle once Play confirms it. Returns "granted" or "pending"."""
    if not configured():
        raise actions.BillingError("Google Play purchases are not available yet.")
    if product not in CREDIT_BUNDLES:
        raise actions.PaymentMismatch("Unknown ticket bundle.")
    token = _check_token(token)
    remote = call("GET", f"purchases/products/{_quote(product)}/tokens/{_quote(token)}")
    if remote.get("purchaseState") == 2:
        return "pending"
    if remote.get("purchaseState") != 0:
        raise actions.PaymentMismatch("That Google Play purchase was cancelled.")
    _owner_matches(user, remote.get("obfuscatedExternalAccountId"))
    _allowed(remote.get("purchaseType") == 0)
    order = remote.get("orderId")
    if not isinstance(order, str) or not order:
        raise actions.PaymentMismatch("Google Play purchase has no order.")
    if remote.get("regionCode") in PURCHASE_BLOCKED_COUNTRIES:
        return _refuse_region(order)
    try:
        actions.grant_bundle(user, "play", f"play:{order}", product)
    except actions.PaymentMismatch as exc:
        raise NeedsReview(str(exc)) from exc
    if remote.get("acknowledgementState") == 0:
        call("POST", f"purchases/products/{_quote(product)}/tokens/{_quote(token)}:acknowledge", {})
    return "granted"


def _refuse_region(order: str) -> str:
    # Refunding with revoke also ends a subscription; the purchase is never granted.
    call("POST", f"orders/{_quote(order)}:refund?revoke=true", {})
    return "unavailable"


def _when(value) -> datetime:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)
    except (AttributeError, ValueError) as exc:
        raise actions.PaymentMismatch("Google Play subscription has no valid dates.") from exc


def verify_subscription(user: User, token: str) -> str:
    """Grant the current paid month of a Play subscription. Safe to repeat."""
    if not configured():
        raise actions.BillingError("Google Play purchases are not available yet.")
    token = _check_token(token)
    remote = call("GET", f"purchases/subscriptionsv2/tokens/{_quote(token)}")
    state = remote.get("subscriptionState")
    if state == "SUBSCRIPTION_STATE_PENDING":
        return "pending"
    if state not in ENTITLED_STATES:
        return "inactive"
    _owner_matches(
        user, (remote.get("externalAccountIdentifiers") or {}).get("obfuscatedExternalAccountId")
    )
    _allowed("testPurchase" in remote)
    items = remote.get("lineItems") or []
    if len(items) != 1 or items[0].get("productId") != settings.PLAY_SUBSCRIPTION_ID:
        raise actions.PaymentMismatch("Unexpected Google Play subscription.")
    item = items[0]
    order = item.get("latestSuccessfulOrderId") or remote.get("latestOrderId")
    if not isinstance(order, str) or not order:
        raise actions.PaymentMismatch("Google Play subscription has no paid order.")
    if remote.get("regionCode") in PURCHASE_BLOCKED_COUNTRIES:
        return _refuse_region(order)
    ends_at = _when(item.get("expiryTime"))
    auto_renews = bool((item.get("autoRenewingPlan") or {}).get("autoRenewEnabled"))
    with transaction.atomic():
        actions.lock_accounts([user.pk])
        grant = StarGrant.objects.filter(provider="play", reference=f"play:{order}").first()
        if grant is None and ends_at > timezone.now():
            # Play reports when a month ends, not when it began, so it starts where the last ended.
            previous = (
                SubscriptionPeriod.objects.filter(
                    subscription__provider="play", subscription__reference=token
                )
                .order_by("-ends_at")
                .first()
            )
            starts_at = _when(remote.get("startTime"))
            if previous:
                starts_at = max(starts_at, previous.ends_at)
            if starts_at < ends_at:
                try:
                    actions.grant_subscription_period(
                        user, "play", f"play:{order}", token, starts_at, ends_at
                    )
                except actions.PaymentMismatch as exc:
                    raise NeedsReview(str(exc)) from exc
        if Subscription.objects.filter(provider="play", reference=token, user=user).exists():
            actions.set_auto_renewal(user, "play", token, auto_renews)
    if remote.get("acknowledgementState") == "ACKNOWLEDGEMENT_STATE_PENDING":
        call(
            "POST",
            f"purchases/subscriptions/{_quote(settings.PLAY_SUBSCRIPTION_ID)}"
            f"/tokens/{_quote(token)}:acknowledge",
            {},
        )
    return "granted"


def sync_subscription(token: str) -> None:
    subscription = Subscription.objects.filter(provider="play", reference=token).first()
    if subscription is None:
        # The app reports a new purchase itself; nothing here can tie it to an account yet.
        return
    if subscription.user.is_active:
        verify_subscription(subscription.user, token)


def void(order: str, token: str) -> None:
    grant = StarGrant.objects.filter(provider="play", reference=f"play:{order}").first()
    if grant is None:
        if not BillingReview.objects.filter(
            provider="play", payment_reference=order, reason="refund_unmatched"
        ).exists():
            BillingReview.objects.create(
                provider="play", payment_reference=order, reason="refund_unmatched"
            )
        return
    actions.reverse_grant(grant, 1, 1)


def sync_voided(since: datetime) -> int:
    """Backstop for missed notifications: apply every refund Play reports since then."""
    if not configured():
        raise actions.BillingError("Google Play billing is not configured.")
    count = 0
    params: dict[str, str] = {"startTime": str(int(since.timestamp() * 1000)), "type": "1"}
    while True:
        page = call("GET", f"purchases/voidedpurchases?{urllib.parse.urlencode(params)}")
        for row in page.get("voidedPurchases", []):
            void(row["orderId"], row.get("purchaseToken", ""))
            count += 1
        next_token = (page.get("tokenPagination") or {}).get("nextPageToken")
        if not next_token:
            return count
        params["token"] = next_token


def cancel_for_closure(user: User) -> None:
    references = list(
        Subscription.objects.filter(user=user, provider="play", auto_renews=True).values_list(
            "reference", flat=True
        )
    )
    if not references:
        return
    if not configured():
        raise actions.BillingError("Google Play billing is not configured.")
    for token in references:
        call(
            "POST",
            f"purchases/subscriptions/{_quote(settings.PLAY_SUBSCRIPTION_ID)}"
            f"/tokens/{_quote(token)}:cancel",
            {},
        )


def verify_push(authorization: str) -> None:
    """Pub/Sub signs each push with a Google ID token for the configured service account."""
    scheme, _, credential = authorization.partition(" ")
    if scheme != "Bearer" or not credential or len(credential) > 8192:
        raise jwt.InvalidTokenError()
    if not settings.PLAY_RTDN_AUDIENCE or not settings.PLAY_RTDN_SERVICE_ACCOUNT:
        raise jwt.InvalidTokenError()
    if jwt.get_unverified_header(credential).get("alg") != "RS256":
        raise jwt.InvalidTokenError()
    claims = jwt.decode(
        credential,
        _keys.get_signing_key_from_jwt(credential).key,
        algorithms=["RS256"],
        audience=settings.PLAY_RTDN_AUDIENCE,
        issuer=["https://accounts.google.com", "accounts.google.com"],
    )
    if (
        not claims.get("email_verified")
        or claims.get("email") != settings.PLAY_RTDN_SERVICE_ACCOUNT
    ):
        raise jwt.InvalidTokenError()


def handle_push(envelope: dict) -> None:
    try:
        data = json.loads(base64.b64decode(envelope["message"]["data"]))
    except (KeyError, TypeError, ValueError) as exc:
        raise actions.PaymentMismatch("Unreadable Play notification.") from exc
    if data.get("packageName") != settings.PLAY_PACKAGE_NAME:
        raise actions.PaymentMismatch("Notification for another app.")
    # Notifications only say something changed; the current state always comes from Google.
    if subscription := data.get("subscriptionNotification"):
        sync_subscription(_check_token(subscription.get("purchaseToken")))
    elif voided := data.get("voidedPurchaseNotification"):
        order = voided.get("orderId")
        if isinstance(order, str) and order:
            void(order, voided.get("purchaseToken", ""))
