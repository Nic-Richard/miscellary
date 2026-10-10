from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from billing.actions import grant_subscription_period
from billing.models import MembershipSettings
from cards.models import CardSet
from cards.publishing import publish_set
from cards.tests.helpers import fill_publishable, make_set
from conftest import make_user
from lounge.models import Attachment, Block, Post, Reply
from packs.actions import open_free_pack
from social.models import Report

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def enabled(settings):
    settings.LOUNGE_ENABLED = True
    settings.MONETIZATION_ENABLED = True


def client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def payload(**extra):
    return {
        "title": "Show us your collection",
        "body": "A few favourites.",
        "rules_accepted": True,
        **extra,
    }


def test_owned_showcases_and_expiry(user, auth_client):
    card_set = make_set(user)
    fill_publishable(card_set)
    assert publish_set(card_set) == []
    card_set.refresh_from_db()
    owned = list(open_free_pack(user, card_set).cards.all())
    ids = [str(card.pk) for card in owned[:2]]
    route = reverse("lounge:feed")
    assert (
        auth_client.post(route, payload(card_ids=ids, style="binder"), format="json").status_code
        == 403
    )
    now = timezone.now()
    period = grant_subscription_period(
        user,
        "web",
        "lounge-month",
        "lounge-sub",
        now - timedelta(minutes=1),
        now + timedelta(days=30),
    )
    response = auth_client.post(route, payload(card_ids=ids, style="binder"), format="json")
    assert response.status_code == 201
    assert response.data["style"] == "binder" and len(response.data["cards"]) == 2
    assert response.data["author_badge"] is True
    assert response.data["cards"][0]["set_slug"] == card_set.slug
    assert response.data["cards"][0]["set_title"] == card_set.title
    assert response.data["cards"][0]["set_creator"]["username"] == user.username
    assert auth_client.post(route, payload(style="display"), format="json").status_code == 400
    Post.objects.filter(pk=response.data["id"]).update(style=Post.Style.DISPLAY)
    legacy = auth_client.get(reverse("lounge:post", args=[response.data["id"]]))
    assert legacy.data["style"] == "plain" and len(legacy.data["cards"]) == 2
    Post.objects.filter(pk=response.data["id"]).update(style=Post.Style.BINDER)
    MembershipSettings.objects.create(user=user, show_badge=False)
    hidden = auth_client.get(reverse("lounge:post", args=[response.data["id"]]))
    assert hidden.data["author_badge"] is False and hidden.data["style"] == "binder"
    MembershipSettings.objects.filter(user=user).update(show_badge=True)
    CardSet.objects.filter(pk=card_set.pk).update(status=CardSet.Status.DELETED)
    assert (
        auth_client.get(reverse("lounge:post", args=[response.data["id"]])).data["cards"][0]
        is not None
    )
    assert auth_client.post(route, payload(card_ids=[ids[0]]), format="json").status_code == 201
    stranger = make_user()
    assert (
        client_for(stranger).post(route, payload(card_ids=[ids[0]]), format="json").status_code
        == 400
    )
    owned[0].owner = stranger
    owned[0].save()
    period.ends_at = now - timedelta(seconds=1)
    period.starts_at = now - timedelta(days=30)
    period.save()
    response = auth_client.get(reverse("lounge:post", args=[response.data["id"]]))
    assert response.data["style"] == "plain" and response.data["body"] == "A few favourites."
    assert response.data["author_badge"] is False
    assert response.data["cards"][0] is None and response.data["cards"][1] is not None
    owned[1].delete()
    assert Attachment.objects.filter(owned_card__isnull=True).count() == 1


def test_threads_parent_binding_and_tombstones(user, auth_client):
    post = Post.objects.create(author=user, title="Collection", body="Hello")
    other = Post.objects.create(author=user, title="Other", body="Hello")
    root = Reply.objects.create(author=user, post=post, body="First")
    route = reverse("lounge:replies", args=[post.pk])
    response = auth_client.post(
        route, {"body": "A reply", "parent_id": str(root.pk)}, format="json"
    )
    assert response.status_code == 201
    child = Reply.objects.get(parent=root)
    assert response.data["id"] == str(child.pk)
    assert response.data["parent_id"] == str(root.pk)
    assert response.data["body"] == "A reply" and response.data["can_delete"]
    assert response.data["author"]["username"] == user.username
    assert response.data["likes"] == 0 and not response.data["liked"]
    assert response.data["child_count"] == 0 and not response.data["removed"]
    assert auth_client.get(route + f"?parent_id={root.pk}").data["results"][0] == response.data
    assert (
        auth_client.post(
            route, {"body": "Too deep", "parent_id": str(child.pk)}, format="json"
        ).status_code
        == 404
    )
    assert (
        auth_client.post(
            reverse("lounge:replies", args=[other.pk]),
            {"body": "Wrong thread", "parent_id": str(root.pk)},
            format="json",
        ).status_code
        == 404
    )
    assert (
        client_for(make_user()).delete(reverse("lounge:reply", args=[root.pk])).status_code == 403
    )
    auth_client.delete(reverse("lounge:reply", args=[root.pk]))
    assert auth_client.get(route).data["results"][0]["body"] == ""
    assert auth_client.get(route + f"?parent_id={root.pk}").data["results"][0]["body"] == "A reply"
    auth_client.delete(reverse("lounge:post", args=[post.pk]))
    assert auth_client.get(reverse("lounge:post", args=[post.pk])).data["author"] is None
    assert auth_client.post(route, {"body": "After removal"}, format="json").status_code == 404


def test_blocks_hide_both_directions_and_stop_interactions(user, auth_client):
    other = make_user()
    their_post = Post.objects.create(author=other, title="Other", body="Hello")
    own_post = Post.objects.create(author=user, title="Mine", body="Hello")
    auth_client.post(reverse("lounge:block", args=[other.username]))
    assert auth_client.get(reverse("lounge:feed")).data["count"] == 1
    assert client_for(other).get(reverse("lounge:feed")).data["count"] == 1
    assert (
        auth_client.post(
            reverse("lounge:replies", args=[their_post.pk]), {"body": "Blocked"}, format="json"
        ).status_code
        == 404
    )
    assert (
        client_for(other).post(reverse("lounge:vote-post", args=[own_post.pk])).status_code == 404
    )
    assert auth_client.post(reverse("lounge:block", args=[user.username])).status_code == 400
    assert auth_client.get(reverse("lounge:blocks")).data[0]["username"] == other.username
    auth_client.delete(reverse("lounge:block", args=[other.username]))
    assert not Block.objects.exists()
    assert auth_client.get(reverse("lounge:feed")).data["count"] == 2


def test_sorting_votes_and_moderation(user, auth_client):
    first = Post.objects.create(author=user, title="Older", body="Hello")
    second = Post.objects.create(author=user, title="Newer", body="Hello")
    vote = reverse("lounge:vote-post", args=[first.pk])
    for _ in range(2):
        assert auth_client.post(vote).data == {"liked": True, "likes": 1}
    feed = reverse("lounge:feed")
    assert auth_client.get(feed).data["results"][0]["id"] == str(second.pk)
    assert auth_client.get(feed + "?sort=top&window=all").data["results"][0]["id"] == str(first.pk)
    auth_client.post(
        reverse("lounge:replies", args=[first.pk]), {"body": "Recent activity"}, format="json"
    )
    assert auth_client.get(feed + "?sort=active").data["results"][0]["id"] == str(first.pk)
    assert auth_client.get(feed + "?sort=wrong").status_code == 400
    response = auth_client.post(
        reverse("social:report"), {"lounge_post_id": str(first.pk), "reason": "spam"}, format="json"
    )
    assert response.status_code == 201 and Report.objects.get().lounge_post_id == first.pk
    assert (
        client_for(make_user(is_staff=True))
        .delete(reverse("lounge:post", args=[first.pk]))
        .status_code
        == 204
    )
    assert auth_client.get(feed).data["count"] == 1


def test_permissions_rules_disabled_and_pagination(user, auth_client, settings):
    route = reverse("lounge:feed")
    settings.LOUNGE_ENABLED = False
    assert not APIClient().get(route).data["enabled"]
    assert auth_client.post(route, payload(), format="json").status_code == 404
    settings.LOUNGE_ENABLED = True
    assert APIClient().post(route, payload(), format="json").status_code == 401
    user.email_verified = False
    user.save()
    assert auth_client.post(route, payload(), format="json").status_code == 403
    user.email_verified = True
    user.save()
    assert auth_client.post(route, payload(rules_accepted=False), format="json").status_code == 400
    Post.objects.bulk_create(
        [Post(author=user, title=f"Post {number}", body="Hello") for number in range(21)]
    )
    response = auth_client.get(route)
    assert (
        response.data["count"] == 21
        and len(response.data["results"]) == 20
        and response.data["next"]
    )


def test_topics_search_and_new_count(user, auth_client, api_client):
    other = make_user()
    trade = Post.objects.create(
        author=user, title="Dreamcast wanted", body="Swapping spares.", topic="trading"
    )
    Post.objects.create(author=other, title="My binder", body="Candy so far.", topic="show")
    route = reverse("lounge:feed")

    def titles(**query):
        return [row["title"] for row in api_client.get(route, query).json()["results"]]

    assert titles(topic="trading") == ["Dreamcast wanted"]
    assert titles(q="dream SPARES") == ["Dreamcast wanted"]
    assert titles(q=other.username) == ["My binder"]
    assert titles(q="dreamcast candy") == []
    assert api_client.get(route, {"topic": "gossip"}).status_code == 400
    assert api_client.get(route, {"new_since": "yesterday"}).status_code == 400
    since = (trade.created_at - timedelta(seconds=1)).isoformat()
    assert api_client.get(route, {"new_since": since}).json() == {"new_count": 2}
    assert api_client.get(route, {"new_since": since, "topic": "show"}).json() == {"new_count": 1}
    created = auth_client.post(route, payload(topic="questions"), format="json")
    assert created.status_code == 201 and created.json()["topic"] == "questions"
    assert auth_client.post(route, payload(topic="gossip"), format="json").status_code == 400
