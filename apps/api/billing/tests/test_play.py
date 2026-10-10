import base64
import json
from datetime import timedelta
from unittest.mock import patch

import jwt
import pytest
from django.urls import reverse
from django.utils import timezone

from accounts.lifecycle import delete_account
from billing import actions, play
from billing.models import BillingReview, StarBalance, StarGrant, Subscription
from conftest import make_user

pytestmark = pytest.mark.django_db
TOKEN = "play-token-" + "x" * 40


@pytest.fixture
def google(settings):
    settings.MONETIZATION_ENABLED = True
    settings.PLAY_BILLING_ENABLED = True
    settings.PLAY_SERVICE_ACCOUNT = '{"type": "service_account"}'
    settings.PLAY_RTDN_AUDIENCE = "https://api.example/notify"
    settings.PLAY_RTDN_SERVICE_ACCOUNT = "pubsub@example.iam.gserviceaccount.com"
    calls = []
    responses: dict = {}

    def fake(method, path, body=None):
        calls.append((method, path))
        for prefix, value in responses.items():
            if path.startswith(prefix):
                return value(path) if callable(value) else value
        return {}

    with patch.object(play, "call", side_effect=fake):
        yield responses, calls


def product(user, **overrides):
    return {
        "purchaseState": 0,
        "purchaseType": 0,
        "acknowledgementState": 0,
        "orderId": "GPA.1",
        "obfuscatedExternalAccountId": play.account_id(user),
        **overrides,
    }


def subscription(user, order="GPA.2", days=30, **overrides):
    now = timezone.now()
    return {
        "subscriptionState": "SUBSCRIPTION_STATE_ACTIVE",
        "acknowledgementState": "ACKNOWLEDGEMENT_STATE_PENDING",
        "testPurchase": {},
        "startTime": (now - timedelta(minutes=1)).isoformat(),
        "externalAccountIdentifiers": {"obfuscatedExternalAccountId": play.account_id(user)},
        "lineItems": [
            {
                "productId": "supporter",
                "latestSuccessfulOrderId": order,
                "expiryTime": (now + timedelta(days=days)).isoformat(),
                "autoRenewingPlan": {"autoRenewEnabled": True},
            }
        ],
        **overrides,
    }


def test_bundle_is_granted_once_acknowledged_and_bound_to_the_account(user, auth_client, google):
    responses, calls = google
    route = reverse("billing:play-purchase")
    body = {"product": "credits_125", "purchase_token": TOKEN}
    assert auth_client.post(route, body, format="json").status_code == 400
    responses["purchases/products/"] = product(user)
    for _ in range(2):
        response = auth_client.post(route, body, format="json", HTTP_X_CLIENT_PLATFORM="mobile")
        assert response.json() == {"status": "granted"}
    assert StarBalance.objects.get(user=user).units == 125000
    assert StarGrant.objects.get().reference == "play:GPA.1"
    assert ("POST", f"purchases/products/credits_125/tokens/{TOKEN}:acknowledge") in calls

    other = make_user()
    with pytest.raises(actions.PaymentMismatch):
        play.verify_product(other, "credits_125", TOKEN)
    responses["purchases/products/"] = product(user, purchaseState=2, orderId="GPA.9")
    assert play.verify_product(user, "credits_125", TOKEN) == "pending"
    responses["purchases/products/"] = product(user, purchaseType=None, orderId="GPA.10")
    with pytest.raises(actions.BillingError):
        play.verify_product(user, "credits_125", TOKEN)
    assert StarGrant.objects.count() == 1


def test_subscription_months_follow_each_other_and_refunds_end_them(user, google, settings):
    responses, calls = google
    responses["purchases/subscriptionsv2/"] = subscription(user)
    assert play.verify_subscription(user, TOKEN) == "granted"
    first = actions.active_period(user)
    assert first.subscription.provider == "play" and first.subscription.auto_renews
    assert StarBalance.objects.get(user=user).units == 100000
    assert any(path.endswith(":acknowledge") for _, path in calls)

    responses["purchases/subscriptionsv2/"] = subscription(
        user, order="GPA.2..0", days=60, acknowledgementState="ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED"
    )
    payload = {
        "subscriptionNotification": {"purchaseToken": TOKEN},
        "packageName": "com.miscellary.app",
    }
    play.handle_push({"message": {"data": base64.b64encode(json.dumps(payload).encode()).decode()}})
    periods = list(first.subscription.periods.order_by("starts_at"))
    assert len(periods) == 2 and periods[1].starts_at == periods[0].ends_at

    play.void("GPA.2..0", TOKEN)
    assert StarBalance.objects.get(user=user).units == 100000
    play.void("GPA.unknown", TOKEN)
    play.void("GPA.unknown", TOKEN)
    assert BillingReview.objects.get().reason == "refund_unmatched"

    delete_account(user)
    assert ("POST", f"purchases/subscriptions/supporter/tokens/{TOKEN}:cancel") in calls
    assert not Subscription.objects.get().auto_renews


def test_unusable_paid_subscription_is_flagged_for_review(user, auth_client, google):
    responses, _ = google
    now = timezone.now()
    actions.grant_subscription_period(
        user, "web", "stripe:in_1", "sub_1", now - timedelta(days=1), now + timedelta(days=29)
    )
    responses["purchases/subscriptionsv2/"] = subscription(user)
    response = auth_client.post(
        reverse("billing:play-purchase"),
        {"product": "subscription", "purchase_token": TOKEN},
        format="json",
        HTTP_X_CLIENT_PLATFORM="mobile",
    )
    assert response.status_code == 400
    assert BillingReview.objects.get(provider="play").payment_reference == TOKEN


def test_notifications_need_a_google_signature(api_client, google):
    route = reverse("billing:play-notify")
    assert api_client.post(route, {}, format="json").status_code == 401
    with patch.object(play, "verify_push", side_effect=jwt.InvalidTokenError()):
        assert (
            api_client.post(route, {}, format="json", HTTP_AUTHORIZATION="Bearer x").status_code
            == 401
        )
    with patch.object(play, "verify_push"):
        assert api_client.post(route, {"message": {}}, format="json").status_code == 204
