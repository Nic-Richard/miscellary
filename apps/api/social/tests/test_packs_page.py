from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone

from cards.publishing import publish_set
from cards.tests.helpers import fill_publishable, make_set
from conftest import make_user
from packs.models import OwnedCard, PackOpening, SetPoints
from social.models import SetFollow

pytestmark = pytest.mark.django_db


def publish(creator, title):
    card_set = make_set(creator, title=title)
    fill_publishable(card_set)
    publish_set(card_set)
    card_set.refresh_from_db()
    return card_set


@pytest.fixture
def sets(db):
    creator = make_user(username="creator")
    return [publish(creator, "Garden Beetles"), publish(creator, "Backyard Rocks")]


def test_following_a_set_puts_it_on_the_packs_page(auth_client, user, sets):
    first, second = sets
    url = reverse("social:follow-set", args=[first.slug])
    assert auth_client.post(url).json() == {"following": True, "follower_count": 1}
    assert auth_client.post(url).json()["follower_count"] == 1

    body = auth_client.get(reverse("social:my-packs")).json()
    assert [r["card_set"]["slug"] for r in body["results"]] == [first.slug]
    assert body["free_count"] == 1

    assert auth_client.delete(url).json() == {"following": False, "follower_count": 0}
    assert auth_client.get(reverse("social:my-packs")).json()["results"] == []


def test_the_set_payload_reports_whether_you_follow_it(auth_client, user, sets):
    first = sets[0]
    detail = reverse("cards:public-set", args=[first.slug])
    assert auth_client.get(detail).json()["following"] is False
    auth_client.post(reverse("social:follow-set", args=[first.slug]))
    body = auth_client.get(detail).json()
    assert body["following"] is True and body["follower_count"] == 1


def test_entries_carry_free_pack_state_points_and_progress(auth_client, user, sets):
    first, second = sets
    for card_set in sets:
        SetFollow.objects.create(user=user, card_set=card_set)
    PackOpening.objects.create(
        user=user,
        card_set=first,
        kind=PackOpening.Kind.FREE,
        opened_on=timezone.now().date(),
    )
    SetPoints.objects.create(user=user, card_set=first, balance=120)
    card = first.cards.first()
    OwnedCard.objects.create(owner=user, card=card)
    OwnedCard.objects.create(owner=user, card=card)

    body = auth_client.get(reverse("social:my-packs")).json()
    rows = {r["card_set"]["slug"]: r for r in body["results"]}
    assert rows[first.slug]["free_available"] is False
    assert rows[first.slug]["points"] == 120
    assert rows[first.slug]["owned_count"] == 1
    assert rows[first.slug]["card_count"] == first.cards.count()
    assert rows[second.slug]["free_available"] is True
    assert body["free_count"] == 1


def test_sets_with_a_free_pack_come_first(auth_client, user, sets):
    first, second = sets
    SetFollow.objects.create(user=user, card_set=first)
    SetFollow.objects.create(user=user, card_set=second)
    PackOpening.objects.create(
        user=user, card_set=second, kind=PackOpening.Kind.FREE, opened_on=timezone.now().date()
    )
    body = auth_client.get(reverse("social:my-packs")).json()
    assert [r["card_set"]["slug"] for r in body["results"]] == [first.slug, second.slug]


def test_an_unpublished_set_leaves_the_packs_page(auth_client, user, sets):
    first = sets[0]
    SetFollow.objects.create(user=user, card_set=first)
    first.soft_delete()
    assert auth_client.get(reverse("social:my-packs")).json()["results"] == []


def test_recent_cards_are_chosen_per_set(auth_client, user, sets):
    """A heavily opened set must not starve the others.

    These used to come from one global slice of the newest copies, so a set the
    collector had been opening could fill it and leave the rest reporting
    nothing pulled while they plainly held cards.
    """
    busy, quiet = sets
    for card_set in sets:
        SetFollow.objects.create(user=user, card_set=card_set)

    early = timezone.now() - timedelta(days=30)
    quiet_card = quiet.cards.first()
    OwnedCard.objects.create(owner=user, card=quiet_card, acquired_at=early)
    OwnedCard.objects.filter(card=quiet_card).update(acquired_at=early)
    for card in busy.cards.all():
        for _ in range(20):
            OwnedCard.objects.create(owner=user, card=card)

    body = auth_client.get(reverse("social:my-packs")).json()
    rows = {r["card_set"]["slug"]: r for r in body["results"]}
    assert len(rows[busy.slug]["recent_cards"]) == busy.cards.count()
    assert [c["id"] for c in rows[quiet.slug]["recent_cards"]] == [str(quiet_card.id)]


def test_recent_cards_are_distinct_cards_not_copies(auth_client, user, sets):
    first, _ = sets
    SetFollow.objects.create(user=user, card_set=first)
    card = first.cards.first()
    for _ in range(12):
        OwnedCard.objects.create(owner=user, card=card)
    rows = auth_client.get(reverse("social:my-packs")).json()["results"]
    assert [c["id"] for c in rows[0]["recent_cards"]] == [str(card.id)]
