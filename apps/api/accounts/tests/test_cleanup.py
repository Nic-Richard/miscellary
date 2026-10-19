from datetime import timedelta
from unittest.mock import Mock

import pytest
from django.utils import timezone

from accounts.cleanup import erase_alerts, run_cleanup
from accounts.lifecycle import delete_account
from accounts.models import AccountCleanup
from cards.tests.helpers import make_set
from conftest import make_user
from social.models import Feedback
from uploads.models import Image

pytestmark = pytest.mark.django_db


def test_closure_queues_original_references_and_private_uploads(user):
    other = make_user()
    feedback = Feedback.objects.create(user=user, kind="bug", message="My email is private")
    private = Image.objects.create(
        owner=user, kind="avatar", key="avatars/private.png", content_type="image/png"
    )
    public = Image.objects.create(
        owner=user, kind="cover", key="covers/public.png", content_type="image/png"
    )
    foreign = Image.objects.create(
        owner=other, kind="avatar", key="avatars/other.png", content_type="image/png"
    )
    pack = Image.objects.create(
        owner=user, kind="pack", key="pack/public.png", content_type="image/png"
    )
    make_set(
        user,
        status="published",
        cover=public,
        pack_layers=[{"kind": "image", "image_id": str(pack.pk)}],
    )
    original_email = user.email
    delete_account(user)
    job = AccountCleanup.objects.get(user_id=user.pk)
    assert {str(user.pk), original_email, str(feedback.pk)} <= set(job.references)
    assert job.storage_keys == [private.key]
    assert job.next_attempt_at > timezone.now()
    assert not Feedback.objects.filter(pk=feedback.pk).exists()
    assert not Image.objects.filter(pk=private.pk).exists()
    assert Image.objects.filter(pk__in=[public.pk, foreign.pk, pack.pk]).count() == 3


def test_cleanup_retains_cursor_on_failure_and_only_finishes_after_storage(user, monkeypatch):
    job = AccountCleanup.objects.create(
        user_id=user.pk, references=[str(user.pk)], storage_keys=["private/a"]
    )
    relay = Mock(
        side_effect=[
            {"complete": False, "cursor": {"123": "456"}},
            OSError("offline"),
            {"complete": True, "cursor": {"123": "done"}},
        ]
    )
    remove = Mock(side_effect=[OSError("storage unavailable"), None])
    monkeypatch.setattr("accounts.cleanup.erase_alerts", relay)
    monkeypatch.setattr("accounts.cleanup.storage.delete_object", remove)
    for _ in range(4):
        AccountCleanup.objects.filter(pk=job.pk).update(next_attempt_at=timezone.now())
        assert run_cleanup()
        job.refresh_from_db()
    assert relay.call_count == 3
    assert relay.call_args_list[1].args[1] == {"123": "456"}
    assert remove.call_count == 2
    assert job.completed_at and job.alerts_complete
    assert job.references == job.storage_keys == [] and job.cursor == {}
    assert not run_cleanup()


def test_cleanup_does_not_process_a_leased_job(user, monkeypatch):
    AccountCleanup.objects.create(
        user_id=user.pk, lease_until=timezone.now() + timedelta(minutes=5)
    )
    relay = Mock()
    monkeypatch.setattr("accounts.cleanup.erase_alerts", relay)
    assert not run_cleanup()
    relay.assert_not_called()


def test_cleanup_clears_all_reference_batches_before_finishing(user, monkeypatch):
    job = AccountCleanup.objects.create(
        user_id=user.pk, references=[f"account-{n}" for n in range(205)]
    )
    relay = Mock(return_value={"complete": True, "cursor": {"123": "done"}})
    monkeypatch.setattr("accounts.cleanup.erase_alerts", relay)
    run_cleanup()
    job.refresh_from_db()
    assert len(job.references) == 5 and job.cursor == {} and not job.completed_at
    AccountCleanup.objects.filter(pk=job.pk).update(next_attempt_at=timezone.now())
    run_cleanup()
    job.refresh_from_db()
    assert job.completed_at


def test_erasure_fails_closed_for_partial_config_and_malformed_progress(settings, monkeypatch):
    settings.ALERTS_URL = "https://alerts.test/alert"
    with pytest.raises(ValueError, match="configuration"):
        erase_alerts(["account-123"], {})
    settings.ALERTS_SECRET = "test-secret"
    response = Mock()
    response.__enter__ = Mock(return_value=response)
    response.__exit__ = Mock(return_value=False)
    response.read.return_value = b'{"complete":true,"cursor":{"123":false}}'
    monkeypatch.setattr("accounts.cleanup.urllib.request.urlopen", Mock(return_value=response))
    with pytest.raises(ValueError, match="progress"):
        erase_alerts(["account-123"], {})
