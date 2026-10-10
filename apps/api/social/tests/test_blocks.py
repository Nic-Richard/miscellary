import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from cards.publishing import publish_set
from cards.tests.helpers import fill_publishable, make_set
from conftest import make_user
from social.models import Block, Comment, Follow, Notification
from trades.actions import TradeError, create_offer
from trades.models import TradeOffer

pytestmark = pytest.mark.django_db


def client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_blocking_works_across_the_app_in_both_directions(user, auth_client):
    other = make_user()
    them = client_for(other)
    card_set = make_set(user, title="Garden Beetles")
    fill_publishable(card_set, n_common=4)
    publish_set(card_set)
    thread = reverse("social:comments", args=[card_set.slug])
    them.post(reverse("social:follow", args=[user.username]))
    auth_client.post(reverse("social:follow", args=[other.username]))
    comment = them.post(thread, {"body": "Hello"}, format="json").data
    pending = TradeOffer.objects.create(sender=other, recipient=user)

    assert auth_client.post(reverse("social:block", args=[other.username])).status_code == 204
    assert not Follow.objects.exists()
    pending.refresh_from_db()
    assert pending.status == TradeOffer.Status.CANCELLED
    assert auth_client.get(thread).data["results"] == []
    assert them.get(thread).data["count"] == 1
    assert (
        auth_client.post(
            thread, {"body": "Hi", "parent_id": comment["id"]}, format="json"
        ).status_code
        == 400
    )
    assert them.post(reverse("social:follow", args=[user.username])).status_code == 400
    with pytest.raises(TradeError):
        create_offer(other, user, [], [])
    before = Notification.objects.filter(recipient=user, actor=other).count()
    them.post(thread, {"body": "Again"}, format="json")
    assert Notification.objects.filter(recipient=user, actor=other).count() == before
    assert auth_client.get(reverse("social:notifications")).data["count"] == 0
    profile = auth_client.get(reverse("social:profile", args=[other.username])).data
    assert profile["is_blocked"]
    assert not them.get(reverse("social:profile", args=[user.username])).data["is_blocked"]
    assert auth_client.get(reverse("social:blocks")).data[0]["username"] == other.username

    auth_client.delete(reverse("social:block", args=[other.username]))
    assert not Block.objects.exists()
    assert len(auth_client.get(thread).data["results"]) == 2
    assert Comment.objects.count() == 2
