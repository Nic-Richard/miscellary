import hashlib
import hmac
import json
import time
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
import stripe
from django.urls import reverse

from accounts.lifecycle import delete_account
from billing import actions
from billing import stripe as payments
from billing.models import (
    BillingReview,
    Checkout,
    StarBalance,
    StarGrant,
    StripeCustomer,
    StripeEvent,
)
from conftest import make_user

pytestmark = pytest.mark.django_db


def obj(**values):
    return stripe.StripeObject.construct_from(values, None)


def event(kind, reference="evt_test", **values):
    return {"id": reference, "type": kind, "livemode": False, "data": {"object": values}}


@pytest.fixture
def provider(settings):
    settings.MONETIZATION_ENABLED = True
    settings.STRIPE_CHECKOUT_ENABLED = True
    settings.STRIPE_SECRET_KEY = "sk_test_offline"
    settings.STRIPE_WEBHOOK_SECRET = "whsec_offline"
    settings.STRIPE_PRICE_IDS = {"credits_125": "price_stars", "subscription": "price_month"}
    settings.STRIPE_PORTAL_CONFIGURATION = "bpc_test"
    api = MagicMock()
    api.v1.prices.retrieve.return_value = obj(currency="usd", unit_amount=500, active=True)
    api.v1.customers.create.return_value = obj(id="cus_test")
    api.v1.checkout.sessions.list.return_value.auto_paging_iter.return_value = []
    api.v1.subscriptions.list.return_value.auto_paging_iter.return_value = []
    api.v1.checkout.sessions.create.side_effect = lambda params, options: obj(
        id="cs_test",
        url="https://checkout.stripe.com/test",
        expires_at=params["expires_at"],
        status="open",
    )
    with patch.object(payments, "client", return_value=api):
        yield api


def prepare(user, provider, product="credits_125"):
    if product == "subscription":
        provider.v1.prices.retrieve.return_value = obj(
            currency="usd",
            unit_amount=499,
            active=True,
            recurring={"interval": "month", "interval_count": 1},
        )
    payments.create_checkout(user, product, uuid4())
    return Checkout.objects.get(user=user)


def settled(checkout, **overrides):
    return obj(
        **{
            "id": "cs_test",
            "metadata": {"miscellary_checkout": str(checkout.pk)},
            "client_reference_id": str(checkout.pk),
            "customer": "cus_test",
            "currency": "usd",
            "amount_subtotal": checkout.price_cents,
            "amount_total": checkout.price_cents,
            "status": "complete",
            "payment_status": "paid",
            "payment_intent": "pi_test",
            **overrides,
        }
    )


def test_checkout_gates_and_server_owned_offer(user, auth_client, provider, settings):
    key = uuid4()
    settings.STRIPE_SECRET_KEY = "sk_live_not_approved"
    with pytest.raises(actions.BillingError):
        payments.create_checkout(user, "credits_125", key)
    provider.v1.customers.create.assert_not_called()
    settings.STRIPE_SECRET_KEY = "sk_test_offline"
    user.email_verified = False
    user.save()
    with pytest.raises(actions.BillingError):
        payments.create_checkout(user, "credits_125", key)
    user.email_verified = True
    user.save()
    route = reverse("billing:checkout")
    assert (
        auth_client.post(
            route, {"product": "credits_125", "request_key": str(key)}, format="json"
        ).status_code
        == 400
    )
    assert (
        auth_client.post(
            route,
            {"product": "credits_125", "request_key": str(key), "amount": 1},
            format="json",
            HTTP_X_CLIENT_PLATFORM="web",
        ).status_code
        == 200
    )
    params = provider.v1.checkout.sessions.create.call_args.args[0]
    assert params["line_items"] == [{"price": "price_stars", "quantity": 1}]
    assert params["customer"] == "cus_test"
    assert params["managed_payments"] == {"enabled": True}
    assert params["success_url"] == "https://miscellary.com/account?checkout=returned"
    assert not StarGrant.objects.exists()


def test_ambiguous_checkout_retry_keeps_intent_and_parameters(user, provider):
    key = uuid4()
    succeed = provider.v1.checkout.sessions.create.side_effect
    provider.v1.checkout.sessions.create.side_effect = stripe.APIConnectionError("offline")
    with pytest.raises(stripe.APIConnectionError):
        payments.create_checkout(user, "credits_125", key)
    checkout = Checkout.objects.get(user=user)
    assert checkout.session_reference is None
    assert StripeCustomer.objects.filter(user=user).exists()
    first = provider.v1.checkout.sessions.create.call_args
    provider.v1.checkout.sessions.create.side_effect = succeed
    payments.create_checkout(user, "credits_125", key)
    assert provider.v1.checkout.sessions.create.call_args == first
    assert Checkout.objects.count() == 1
    provider.v1.customers.create.assert_called_once()
    provider.v1.checkout.sessions.retrieve.return_value = obj(
        status="open", url="https://checkout.stripe.com/test"
    )
    payments.create_checkout(user, "credits_125", key)
    assert provider.v1.checkout.sessions.create.call_count == 2
    with pytest.raises(actions.BillingError):
        payments.create_checkout(user, "subscription", key)


def test_signed_callbacks_bind_payment_and_deduplicate(user, provider, api_client):
    checkout = prepare(user, provider)
    provider.v1.checkout.sessions.retrieve.return_value = settled(checkout)
    route = reverse("billing:stripe-webhook")
    payload = json.dumps(event("checkout.session.completed", id="cs_test")).encode()
    now = int(time.time())
    signature = hmac.new(
        b"whsec_offline", str(now).encode() + b"." + payload, hashlib.sha256
    ).hexdigest()
    header = f"t={now},v1={signature}"
    assert (
        api_client.post(
            route, payload, content_type="application/json", HTTP_STRIPE_SIGNATURE="bad"
        ).status_code
        == 400
    )
    assert (
        api_client.post(
            route, payload + b" ", content_type="application/json", HTTP_STRIPE_SIGNATURE=header
        ).status_code
        == 400
    )
    assert not StripeEvent.objects.exists()
    stale = now - 360
    stale_signature = hmac.new(
        b"whsec_offline", str(stale).encode() + b"." + payload, hashlib.sha256
    ).hexdigest()
    assert (
        api_client.post(
            route,
            payload,
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE=f"t={stale},v1={stale_signature}",
        ).status_code
        == 400
    )
    for _ in range(2):
        assert (
            api_client.post(
                route, payload, content_type="application/json", HTTP_STRIPE_SIGNATURE=header
            ).status_code
            == 204
        )
    payments.process_event(
        event("checkout.session.async_payment_succeeded", "evt_second", id="cs_test")
    )
    assert StarBalance.objects.get(user=user).units == 125000
    assert StarGrant.objects.count() == 1


def test_late_payment_after_closure_is_kept_for_review(user, provider):
    checkout = prepare(user, provider)
    delete_account(user)
    provider.v1.checkout.sessions.retrieve.return_value = settled(checkout)
    payments.process_event(event("checkout.session.completed", id="cs_test"))
    assert not StarGrant.objects.exists()
    assert BillingReview.objects.get().reason == "payment_after_closure"


def test_callback_recovers_unknown_session_and_rejects_wrong_account(user, provider):
    checkout = prepare(user, provider)
    checkout.session_reference = None
    checkout.save()
    provider.v1.checkout.sessions.retrieve.return_value = settled(checkout, customer="cus_wrong")
    with pytest.raises(actions.BillingError):
        payments.process_event(event("checkout.session.completed", id="cs_test"))
    assert not StripeEvent.objects.exists()
    assert not StarGrant.objects.exists()
    provider.v1.checkout.sessions.retrieve.return_value = settled(checkout, amount_total=0)
    with pytest.raises(actions.BillingError):
        payments.process_event(event("checkout.session.completed", id="cs_test"))
    assert not StarGrant.objects.exists()
    provider.v1.checkout.sessions.retrieve.return_value = settled(checkout)
    payments.process_event(event("checkout.session.completed", id="cs_test"))
    checkout.refresh_from_db()
    assert checkout.completed and checkout.session_reference == "cs_test"
    assert StarBalance.objects.get(user=user).units == 125000


def test_invoice_grants_paid_period_once_and_uses_current_cancellation(user, provider):
    checkout = prepare(user, provider, "subscription")
    with pytest.raises(actions.BillingError):
        payments.create_checkout(user, "subscription", uuid4())
    now = int(time.time())
    provider.v1.subscriptions.retrieve.return_value = obj(
        id="sub_test",
        customer="cus_test",
        status="active",
        cancel_at_period_end=True,
        metadata={"miscellary_checkout": str(checkout.pk)},
    )
    provider.v1.invoices.retrieve.return_value = obj(
        id="in_test",
        parent={"subscription_details": {"subscription": "sub_test"}},
        billing_reason="subscription_create",
        status="paid",
        amount_remaining=0,
        total=499,
        amount_paid=499,
        currency="usd",
        customer="cus_test",
    )
    provider.v1.invoices.line_items.list.return_value = obj(
        has_more=False,
        data=[
            {
                "pricing": {"price_details": {"price": "price_month"}},
                "quantity": 1,
                "amount": 499,
                "period": {"start": now - 60, "end": now + 30 * 86400},
            }
        ],
    )
    payments.process_event(event("invoice.paid", id="in_test"))
    provider.v1.subscriptions.retrieve.return_value.status = "past_due"
    payments.process_event(event("invoice.paid", "evt_duplicate_invoice", id="in_test"))
    period = actions.active_period(user)
    assert period.bonus_packs_remaining == 10 and not period.subscription.auto_renews
    assert StarBalance.objects.get(user=user).units == 100000
    payments.process_event(
        event(
            "customer.subscription.updated",
            "evt_old_update",
            id="sub_test",
            cancel_at_period_end=False,
        )
    )
    period.subscription.refresh_from_db()
    assert not period.subscription.auto_renews
    provider.v1.invoices.retrieve.return_value.amount_paid = 0
    with pytest.raises(actions.BillingError):
        payments.process_event(event("invoice.paid", "evt_unpaid", id="in_test"))
    assert not StripeEvent.objects.filter(pk="evt_unpaid").exists()


def test_management_is_account_bound_and_closure_cancels_before_deleting(user, provider):
    checkout = prepare(user, provider, "subscription")
    provider.v1.billing_portal.sessions.create.return_value = obj(
        url="https://billing.stripe.com/test"
    )
    assert payments.portal(user)["url"] == "https://billing.stripe.com/test"
    assert provider.v1.billing_portal.sessions.create.call_args.args[0]["customer"] == "cus_test"
    with pytest.raises(actions.BillingError):
        payments.portal(make_user())
    remote = settled(checkout, subscription="sub_test")
    provider.v1.checkout.sessions.list.return_value.auto_paging_iter.side_effect = lambda: iter(
        [remote]
    )
    provider.v1.subscriptions.retrieve.return_value = obj(
        id="sub_test", customer="cus_test", status="active"
    )
    provider.v1.subscriptions.cancel.side_effect = stripe.APIConnectionError("offline")
    with pytest.raises(stripe.APIConnectionError):
        delete_account(user)
    user.refresh_from_db()
    assert user.is_active and user.deleted_at is None
    provider.v1.subscriptions.cancel.side_effect = None
    delete_account(user)
    provider.v1.subscriptions.cancel.assert_called_with(
        "sub_test", {"invoice_now": False, "prorate": False}
    )
    user.refresh_from_db()
    assert user.deleted_at is not None


def test_refund_and_dispute_need_review_without_confiscating_cards(user, provider):
    checkout = prepare(user, provider)
    provider.v1.checkout.sessions.retrieve.return_value = settled(checkout)
    payments.process_event(event("checkout.session.completed", id="cs_test"))
    for kind, key in [("charge.refunded", "evt_refund"), ("charge.dispute.created", "evt_dispute")]:
        notification = event(kind, key, id="ch_test")
        payments.process_event(notification)
        payments.process_event(notification)
    assert BillingReview.objects.count() == 2
    assert StarBalance.objects.get(user=user).units == 125000
