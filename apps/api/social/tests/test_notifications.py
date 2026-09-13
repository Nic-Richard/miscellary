import pytest
from django.db import IntegrityError
from django.urls import reverse

from cards.publishing import publish_set
from cards.tests.helpers import fill_publishable, make_set
from conftest import make_user
from social.models import Notification

pytestmark = pytest.mark.django_db


@pytest.fixture
def published(user):
    card_set = make_set(user, title="Garden Beetles")
    fill_publishable(card_set)
    publish_set(card_set)
    card_set.refresh_from_db()
    return card_set


@pytest.fixture
def fan(api_client):
    other = make_user(username="fan")
    api_client.force_authenticate(other)
    return other


def kinds(user) -> list[str]:
    return list(Notification.objects.filter(recipient=user).values_list("kind", flat=True))


def test_liking_a_set_notifies_its_creator(api_client, user, published, fan):
    url = reverse("social:like-set", args=[published.slug])
    api_client.post(url)
    assert kinds(user) == ["set_like"]

    api_client.delete(url)
    assert kinds(user) == []

    api_client.post(url)
    api_client.delete(url)
    api_client.post(url)
    assert kinds(user) == ["set_like"]


def test_liking_a_card_notifies_the_set_creator(api_client, user, published, fan):
    card = published.cards.first()
    api_client.post(reverse("social:like-card", args=[card.id]))
    row = Notification.objects.get(recipient=user)
    assert row.kind == "card_like"
    assert row.card_id == card.id and row.card_set_id == published.id


def test_comments_notify_the_creator_and_replies_notify_the_author(
    api_client, user, published, fan
):
    comments = reverse("social:comments", args=[published.slug])
    top = api_client.post(comments, {"body": "Lovely set."}, format="json").json()
    assert kinds(user) == ["set_comment"]

    api_client.force_authenticate(user)
    api_client.post(comments, {"body": "Thank you."}, format="json")
    api_client.post(comments, {"body": "Thanks!", "parent_id": top["id"]}, format="json")
    assert kinds(user) == ["set_comment"]
    assert kinds(fan) == ["comment_reply"]


def test_nothing_you_do_yourself_is_a_notification(auth_client, user, published):
    auth_client.post(reverse("social:like-set", args=[published.slug]))
    auth_client.post(
        reverse("social:comments", args=[published.slug]), {"body": "Mine."}, format="json"
    )
    assert kinds(user) == []


def test_following_notifies_and_unfollowing_withdraws(api_client, user, fan):
    url = reverse("social:follow", args=[user.username])
    api_client.post(url)
    assert kinds(user) == ["follow"]
    api_client.delete(url)
    assert kinds(user) == []


def test_listing_and_marking_read(auth_client, user, published):
    other = make_user(username="reader")
    Notification.objects.create(recipient=user, actor=other, kind="follow")
    Notification.objects.create(recipient=user, actor=other, kind="set_like", card_set=published)

    url = reverse("social:notifications")
    body = auth_client.get(url).json()
    assert body["unread"] == 2
    assert [r["kind"] for r in body["results"]] == ["set_like", "follow"]
    assert body["results"][0]["set_slug"] == published.slug
    assert body["results"][0]["actor"]["username"] == "reader"
    assert body["results"][0]["read"] is False

    one = body["results"][0]["id"]
    assert auth_client.post(url, {"id": one}, format="json").json() == {"unread": 1}
    assert auth_client.post(url, {}, format="json").json() == {"unread": 0}
    assert auth_client.get(url).json()["results"][0]["read"] is True


def test_a_read_notification_does_not_block_the_next_one(api_client, user, published, fan):
    url = reverse("social:like-set", args=[published.slug])
    api_client.post(url)
    Notification.objects.filter(recipient=user).update(read_at="2026-01-01T00:00:00Z")
    api_client.delete(url)
    api_client.post(url)
    assert kinds(user) == ["set_like", "set_like"]


def test_liking_again_does_not_make_another_notification(api_client, user, published, fan):
    """A repeated POST is a no-op on the like, so it must be one on the notice.

    Nothing rate-limits the like endpoints, so notifying on every POST would let
    anyone refill a creator's list by liking in a loop.
    """
    url = reverse("social:like-set", args=[published.slug])
    api_client.post(url)
    Notification.objects.filter(recipient=user).update(read_at="2026-01-01T00:00:00Z")
    api_client.post(url)
    api_client.post(url)
    assert kinds(user) == ["set_like"]


def test_one_unread_notification_per_target_is_enforced_by_the_database(user, published, fan):
    Notification.objects.create(
        recipient=user, actor=fan, kind=Notification.Kind.SET_LIKE, card_set=published
    )
    with pytest.raises(IntegrityError):
        Notification.objects.create(
            recipient=user, actor=fan, kind=Notification.Kind.SET_LIKE, card_set=published
        )


def test_follows_are_deduped_too_despite_carrying_no_target(user, fan):
    Notification.objects.create(recipient=user, actor=fan, kind=Notification.Kind.FOLLOW)
    with pytest.raises(IntegrityError):
        Notification.objects.create(recipient=user, actor=fan, kind=Notification.Kind.FOLLOW)


def test_notifications_are_paged(auth_client, user, published):
    readers = [make_user(username=f"reader{n}") for n in range(35)]
    Notification.objects.bulk_create(
        [
            Notification(recipient=user, actor=reader, kind=Notification.Kind.FOLLOW)
            for reader in readers
        ]
    )
    url = reverse("social:notifications")
    first = auth_client.get(url).json()
    assert first["count"] == 35
    assert len(first["results"]) == 30
    assert first["unread"] == 35
    assert first["next"] is not None

    second = auth_client.get(url, {"page": 2}).json()
    assert len(second["results"]) == 5
    assert second["next"] is None
