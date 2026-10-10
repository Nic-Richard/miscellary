from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from billing.actions import grant_subscription_period
from billing.models import SubscriptionPeriod
from cards.publishing import publish_set
from cards.tests.helpers import fill_publishable, make_set
from conftest import make_user
from lounge.models import Post, Reply
from packs.models import OwnedCard
from social.models import Notification, ShowcaseSlot

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def enabled(settings):
    settings.LOUNGE_ENABLED = True
    settings.MONETIZATION_ENABLED = True


def client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def support(user):
    now = timezone.now()
    grant_subscription_period(
        user,
        "web",
        f"ref-{user.pk}",
        f"sub-{user.pk}",
        now - timedelta(minutes=1),
        now + timedelta(days=30),
    )


def cards_for(user, count):
    card_set = make_set(user)
    fill_publishable(card_set, n_common=count)
    publish_set(card_set)
    return [
        str(OwnedCard.objects.create(owner=user, card=card).pk)
        for card in card_set.cards.all()[:count]
    ]


def post(client, **extra):
    body = {"title": "Keys", "body": "Hello @keyfan", "rules_accepted": True, **extra}
    return client.post(reverse("lounge:feed"), body, format="json")


def test_editing_drafts_saves_and_unread(user, auth_client):
    fan = make_user(username="keyfan")
    created = post(auth_client).data
    assert Notification.objects.get(recipient=fan).kind == Notification.Kind.LOUNGE_MENTION
    route = reverse("lounge:post", args=[created["id"]])
    edited = auth_client.patch(route, {"body": "Changed"}, format="json").data
    assert edited["edited"] and edited["body"] == "Changed" and edited["can_edit"]
    assert client_for(fan).patch(route, {"body": "Mine"}, format="json").status_code == 404

    assert post(auth_client, draft=True).status_code == 403
    support(user)
    draft = post(auth_client, draft=True, title="Later").data
    assert draft["draft"] and not draft["edited"]
    feed = reverse("lounge:feed")
    assert [row["id"] for row in auth_client.get(feed).data["results"]] == [created["id"]]
    assert client_for(fan).get(reverse("lounge:post", args=[draft["id"]])).status_code == 404
    assert auth_client.get(reverse("lounge:drafts")).data["count"] == 1
    published = auth_client.patch(
        reverse("lounge:post", args=[draft["id"]]), {"publish": True}, format="json"
    ).data
    assert not published["draft"] and not published["edited"]

    fans = client_for(fan)
    save = reverse("lounge:save", args=[created["id"]])
    assert fans.post(save, {}, format="json").data["saved"]
    assert fans.post(reverse("lounge:folders"), {"name": "Keys"}, format="json").status_code == 403
    assert fans.get(feed + "?saved=1").data["count"] == 1

    fans.get(route)
    unread = {row["id"]: row["unread"] for row in fans.get(feed).data["results"]}
    assert not unread[created["id"]]
    replies = reverse("lounge:replies", args=[created["id"]])
    auth_client.post(replies, {"body": "More"}, format="json")
    unread = {row["id"]: row["unread"] for row in fans.get(feed).data["results"]}
    assert unread[created["id"]]

    support(fan)
    folder = fans.post(reverse("lounge:folders"), {"name": "Keys"}, format="json").data
    fans.post(save, {"folder_id": folder["id"]}, format="json")
    assert fans.get(f"{feed}?saved=1&folder={folder['id']}").data["count"] == 1
    assert fans.get(reverse("lounge:folders")).data[0]["count"] == 1


def test_replies_sort_op_cards_and_notifications(user, auth_client):
    other = make_user()
    created = post(auth_client).data
    route = reverse("lounge:replies", args=[created["id"]])
    theirs = client_for(other).post(route, {"body": "First"}, format="json").data
    assert Notification.objects.filter(recipient=user, kind="lounge_reply").exists()
    mine = auth_client.post(route, {"body": "Second"}, format="json").data
    assert mine["is_op"] and not theirs["is_op"]
    client_for(make_user()).post(
        reverse("lounge:vote-reply", args=[mine["id"]]), {"value": 1}, format="json"
    )
    top = auth_client.get(route).data["results"]
    assert [row["id"] for row in top] == [mine["id"], theirs["id"]]
    oldest = auth_client.get(route + "?sort=oldest").data["results"]
    assert [row["id"] for row in oldest] == [theirs["id"], mine["id"]]
    assert auth_client.get(route + "?sort=bad").status_code == 400

    ids = cards_for(user, 4)
    too_many = auth_client.post(route, {"body": "Cards", "card_ids": ids}, format="json")
    assert too_many.status_code == 400
    with_cards = auth_client.post(route, {"body": "Cards", "card_ids": ids[:3]}, format="json")
    assert with_cards.status_code == 201 and len(with_cards.data["cards"]) == 3
    edited = auth_client.patch(
        reverse("lounge:reply", args=[with_cards.data["id"]]), {"body": "Edited"}, format="json"
    ).data
    assert edited["edited"] and Reply.objects.get(pk=edited["id"]).body == "Edited"


def test_card_limits_binder_summary_and_badge(user, auth_client):
    ids = cards_for(user, 8)
    assert post(auth_client, card_ids=ids[:7]).status_code == 400
    assert post(auth_client, card_ids=ids[:6]).status_code == 201
    assert post(auth_client, card_ids=ids, style="binder").status_code == 403
    support(user)
    binder = post(auth_client, card_ids=ids, style="binder").data
    assert binder["style"] == "binder" and len(binder["cards"]) == 8

    auth_client.patch(
        reverse("billing:membership"),
        {"badge_colour": "jade", "badge_finish": "holo"},
        format="json",
    )
    shown = auth_client.get(reverse("lounge:post", args=[binder["id"]])).data
    assert shown["author_badge"] == "jade-holo"
    auth_client.put(reverse("social:featured-card"), {"owned_card_id": ids[0]}, format="json")
    summary = APIClient().get(reverse("social:summary", args=[user.username])).data
    assert summary["badge_style"] == "jade-holo" and summary["featured_card"] is not None
    assert summary["card_count"] == 8

    showcase = reverse("social:showcase")
    slots = [{"position": "75", "owned_card_id": ids[1]}]
    assert auth_client.put(showcase, {"slots": slots}, format="json").status_code == 200
    profile = APIClient().get(reverse("social:profile", args=[user.username])).data
    assert profile["showcase_slots"] == 80 and len(profile["showcase"]) == 1
    SubscriptionPeriod.objects.update(ends_at=timezone.now() - timedelta(seconds=1))
    profile = APIClient().get(reverse("social:profile", args=[user.username])).data
    assert profile["showcase_slots"] == 40 and profile["showcase"] == []
    assert profile["featured_card"] is None
    auth_client.put(showcase, {"slots": []}, format="json")
    assert ShowcaseSlot.objects.filter(position=74).exists()
    assert Post.objects.get(pk=binder["id"]).style == "binder"
