import logging

import pytest
from django.urls import reverse

from billing import actions
from billing.models import BillingReview
from common import alerts
from conftest import make_user
from social.models import Feedback


@pytest.fixture
def sent(settings, monkeypatch):
    settings.ALERTS_URL = "https://alerts.test/alert"
    settings.ALERTS_SECRET = "s" * 40
    payloads: list[dict] = []
    monkeypatch.setattr(alerts, "_dispatch", payloads.append)
    # Alerts wait for the transaction to commit; tests run inside one, so send them straight away.
    monkeypatch.setattr(alerts.transaction, "on_commit", lambda callback: callback())
    return payloads


def test_feedback_is_saved_and_sent_to_bugs(auth_client, user, sent):
    response = auth_client.post(
        reverse("social:feedback"),
        {"kind": "bug", "message": "The binder won't turn.", "page": "/sets/x", "client": "web"},
        format="json",
    )
    assert response.status_code == 201
    assert Feedback.objects.get().user == user
    [payload] = sent
    assert payload["type"] == "bugs"
    assert payload["description"] == "The binder won't turn."
    assert payload["url"].endswith("/sets/x")
    assert {"name": "From", "value": f"@{user.username}"} in payload["fields"]


def test_feedback_needs_a_real_message(auth_client, sent):
    response = auth_client.post(
        reverse("social:feedback"), {"kind": "bug", "message": "hi"}, format="json"
    )
    assert response.status_code == 400
    assert sent == []


def test_report_goes_to_reports(auth_client, sent):
    target = make_user(username="spammer")
    auth_client.post(
        reverse("social:report"), {"username": target.username, "reason": "spam"}, format="json"
    )
    [payload] = sent
    assert payload["type"] == "reports"
    assert payload["title"] == "Spam: User: @spammer"


def test_purchases_and_reviews_go_to_billing(user, sent):
    actions.grant_bundle(user, "web", "payment-1", "credits_125")
    actions.grant_bundle(user, "web", "payment-1", "credits_125")
    BillingReview.objects.create(payment_reference="payment-2", reason="mismatch")
    assert [p["title"] for p in sent] == ["125 tickets bought", "Payment needs a review"]
    assert all(p["type"] == "billing" for p in sent)


def test_error_logs_go_to_errors(sent):
    try:
        raise ValueError("boom")
    except ValueError:
        logging.getLogger("django.request").exception("Internal Server Error: /api/v1/x/")
    [payload] = sent
    assert payload["type"] == "errors"
    assert payload["key"].startswith("ValueError:")
    assert "boom" in payload["description"]


def test_nothing_is_sent_when_alerts_are_off(auth_client, monkeypatch):
    payloads: list[dict] = []
    monkeypatch.setattr(alerts, "_dispatch", payloads.append)
    auth_client.post(
        reverse("social:feedback"),
        {"kind": "idea", "message": "More binder colours."},
        format="json",
    )
    assert payloads == []


def test_requests_for_unknown_hosts_are_not_alerted(client, sent):
    response = client.get("/", HTTP_HOST="52.87.74.21")
    assert response.status_code == 400
    assert sent == []
