import hashlib
import hmac
import json
import time
from uuid import uuid4

import pytest

from accounts.tests.test_lifecycle import published_set
from common.models import ModerationAction
from conftest import make_user
from packs.models import OwnedCard
from social.models import Comment, Feedback, Report

pytestmark = pytest.mark.django_db
SECRET = "m" * 40
ACTOR = {"id": "123456789", "name": "Moderator", "permissions": str(1 << 40)}


@pytest.fixture
def call(api_client, settings):
    settings.ALERTS_ACTION_SECRET = SECRET

    def send(target, action="inspect", **overrides):
        data = {
            "requestId": str(uuid4()),
            "target": {
                "kind": "feedback" if isinstance(target, Feedback) else "report",
                "id": str(target.pk),
            },
            "action": action,
            "actor": ACTOR,
            **overrides,
        }
        raw = json.dumps(data).encode()
        timestamp = str(int(time.time()))
        signature = hmac.new(
            SECRET.encode(), timestamp.encode() + b"." + raw, hashlib.sha256
        ).hexdigest()
        return api_client.post(
            "/api/v1/moderation/discord/",
            raw,
            content_type="application/json",
            HTTP_X_ACTION_TIMESTAMP=timestamp,
            HTTP_X_ACTION_SIGNATURE=signature,
        )

    return send


def test_feedback_decision_replays_once_and_keeps_actual_actor(call, user):
    feedback = Feedback.objects.create(user=user, kind="bug", message="Broken button")
    version = call(feedback).json()["version"]
    operation = str(uuid4())
    response = call(feedback, "dismiss", expectedVersion=version, requestId=operation)
    assert response.status_code == 200
    assert response.json()["status"] == "dismissed"
    assert (
        call(feedback, "dismiss", expectedVersion=version, requestId=operation).json()
        == response.json()
    )
    assert ModerationAction.objects.count() == 1
    assert call(feedback).json()["status"] == "dismissed"
    feedback.refresh_from_db()
    assert feedback.resolved


def test_callback_rejects_unsigned_nonmoderator_and_stale_decisions(call, api_client, user):
    report = Report.objects.create(reporter=user, reason="spam", reported_user=user)
    assert api_client.post("/api/v1/moderation/discord/", {}, format="json").status_code == 401
    assert call(report, actor={**ACTOR, "permissions": "0"}).status_code == 403
    assert call(report, actor={**ACTOR, "permissions": "-1"}).status_code == 403
    version = call(report).json()["version"]
    report.details = "New evidence"
    report.save()
    assert call(report, "resolve", expectedVersion=version).status_code == 409
    assert call(report, "hide", expectedVersion=call(report).json()["version"]).status_code == 409
    assert ModerationAction.objects.count() == 0


def test_set_hiding_keeps_copies_and_can_be_undone(call, user):
    card_set = published_set(user)
    card = card_set.cards.first()
    OwnedCard.objects.create(owner=user, card=card)
    OwnedCard.objects.create(owner=make_user(), card=card)
    report = Report.objects.create(reporter=user, card=card, reason="explicit")
    state = call(report).json()
    assert "hide" in state["actions"] and "remove" not in state["actions"]
    hidden = call(report, "hide", expectedVersion=state["version"])
    assert hidden.status_code == 200
    assert hidden.json()["actions"] == ["reopen", "unhide"]
    card_set.refresh_from_db()
    assert card_set.status == "hidden"
    assert OwnedCard.objects.filter(card__card_set=card_set).count() == 2
    restored = call(report, "unhide", expectedVersion=hidden.json()["version"])
    assert restored.status_code == 200
    card_set.refresh_from_db()
    assert card_set.is_published


def test_comment_removal_tombstones_only_the_reported_item(call, user):
    card_set = published_set(user)
    comment = Comment.objects.create(author=user, card_set=card_set, body="Reported text")
    report = Report.objects.create(reporter=user, comment=comment, reason="harassment")
    state = call(report).json()
    assert call(report, "remove", expectedVersion=state["version"]).status_code == 200
    comment.refresh_from_db()
    card_set.refresh_from_db()
    assert comment.deleted_at is not None
    assert card_set.is_published


def test_reusing_operation_for_a_different_target_is_rejected(call, user):
    one = Feedback.objects.create(user=user, kind="bug", message="One")
    two = Feedback.objects.create(user=user, kind="bug", message="Two")
    operation = str(uuid4())
    assert (
        call(
            one, "resolve", expectedVersion=call(one).json()["version"], requestId=operation
        ).status_code
        == 200
    )
    assert (
        call(
            two, "resolve", expectedVersion=call(two).json()["version"], requestId=operation
        ).status_code
        == 409
    )
    two.refresh_from_db()
    assert not two.resolved


def test_reopening_preserves_receipts_and_keeps_a_set_hidden(call, user):
    card_set = published_set(user)
    card = card_set.cards.first()
    OwnedCard.objects.create(owner=user, card=card)
    report = Report.objects.create(reporter=user, card_set=card_set, reason="explicit")
    initial = call(report).json()
    operation = str(uuid4())
    hidden = call(report, "hide", expectedVersion=initial["version"], requestId=operation).json()
    reopened = call(report, "reopen", expectedVersion=hidden["version"])
    assert reopened.status_code == 200
    assert reopened.json()["status"] == "open"
    assert "hide" not in reopened.json()["actions"]
    assert "unhide" in reopened.json()["actions"]
    assert (
        call(report, "hide", expectedVersion=initial["version"], requestId=operation).json()
        == hidden
    )
    assert call(report, "resolve", expectedVersion=initial["version"]).status_code == 409
    card_set.refresh_from_db()
    assert card_set.status == "hidden"
    assert OwnedCard.objects.filter(card__card_set=card_set).exists()


def test_hidden_sets_stay_private_and_untradeable(api_client, user):
    from cards.models import CardSet
    from trades.actions import TradeError, create_offer

    creator, other = make_user(), make_user()
    card_set = published_set(creator)
    mine = OwnedCard.objects.create(owner=user, card=card_set.cards.first())
    OwnedCard.objects.create(owner=other, card=card_set.cards.first())
    card_set.status = CardSet.Status.HIDDEN
    card_set.save(update_fields=["status"])

    assert api_client.get(f"/api/v1/sets/{card_set.slug}/").status_code == 404
    assert api_client.get(f"/api/v1/users/{user.username}/cards/").json()["count"] == 0
    api_client.force_authenticate(user)
    assert api_client.get("/api/v1/me/cards/").json()["count"] == 1
    with pytest.raises(TradeError, match="under review"):
        create_offer(user, other, [mine.pk], [])
    api_client.force_authenticate(creator)
    assert api_client.delete(f"/api/v1/me/sets/{card_set.id}/").status_code == 400
    card_set.refresh_from_db()
    assert card_set.status == "hidden"


def test_user_ban_and_unban_preserve_account_data_and_reject_staff_or_deleted_users(
    call, api_client, user
):
    from django.urls import reverse
    from django.utils import timezone
    from rest_framework_simplejwt.tokens import RefreshToken

    account = make_user()
    card_set = published_set(account)
    owned = OwnedCard.objects.create(owner=account, card=card_set.cards.first())
    token = str(RefreshToken.for_user(account).access_token)
    report = Report.objects.create(reporter=user, reported_user=account, reason="harassment")
    initial = call(report).json()
    banned = call(report, "ban", expectedVersion=initial["version"])
    assert banned.status_code == 200
    account.refresh_from_db()
    assert not account.is_active and account.deleted_at is None
    assert OwnedCard.objects.filter(pk=owned.pk, owner=account).exists()
    assert (
        api_client.get(reverse("accounts:me"), HTTP_AUTHORIZATION=f"Bearer {token}").status_code
        == 401
    )
    unbanned = call(report, "unban", expectedVersion=call(report).json()["version"])
    assert unbanned.status_code == 200
    account.refresh_from_db()
    assert account.is_active
    assert (
        api_client.get(reverse("accounts:me"), HTTP_AUTHORIZATION=f"Bearer {token}").status_code
        == 200
    )
    account.deleted_at = timezone.now()
    account.is_active = False
    account.save()
    state = call(report).json()
    assert "unban" not in state["actions"]
    assert call(report, "unban", expectedVersion=state["version"]).status_code == 409
    account.deleted_at = None
    account.is_staff = True
    account.save()
    assert "unban" not in call(report).json()["actions"]
