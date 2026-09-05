import random
import threading
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest
from django.db import connection

from cards.publishing import publish_set
from cards.tests.helpers import fill_publishable, make_set
from conftest import make_user
from packs import actions
from packs.models import OwnedCard, PackOpening, SetPoints
from trades import actions as trades
from trades.models import TradeOffer

pytestmark = pytest.mark.django_db


@pytest.fixture
def published(user):
    card_set = make_set(user)
    fill_publishable(card_set, n_common=6, extra=("uncommon", "rare", "epic", "legendary"))
    publish_set(card_set)
    card_set.refresh_from_db()
    return card_set


def test_free_pack_gives_pack_size_cards(user, published):
    opening = actions.open_free_pack(user, published)
    assert opening.kind == "free"
    assert opening.cards.count() == actions.PACK_SIZE
    assert OwnedCard.objects.filter(owner=user).count() == actions.PACK_SIZE
    assert not actions.free_pack_available(user, published)


def test_creator_selected_pack_size_controls_cards_received(user):
    card_set = make_set(user, pack_size=3)
    fill_publishable(card_set)
    publish_set(card_set)
    card_set.refresh_from_db()

    opening = actions.open_free_pack(user, card_set)

    assert opening.cards.count() == 3
    assert OwnedCard.objects.filter(owner=user).count() == 3


def test_only_one_free_pack_per_set_per_day(user, published):
    actions.open_free_pack(user, published)
    with pytest.raises(actions.PackError, match="already opened"):
        actions.open_free_pack(user, published)
    # A different set is a separate daily allowance.
    other = make_set(user, title="Other")
    fill_publishable(other)
    publish_set(other)
    other.refresh_from_db()
    actions.open_free_pack(user, other)


def test_free_pack_resets_on_the_next_utc_date(user, published):
    first_day = datetime(2026, 1, 10, 23, 59, tzinfo=UTC)
    with patch("packs.actions.timezone.now", return_value=first_day):
        actions.open_free_pack(user, published)
        assert not actions.free_pack_available(user, published)

    with patch("packs.actions.timezone.now", return_value=first_day + timedelta(minutes=2)):
        assert actions.free_pack_available(user, published)
        actions.open_free_pack(user, published)

    assert PackOpening.objects.filter(user=user, card_set=published).count() == 2


def test_unpublished_sets_have_no_packs(user):
    draft = make_set(user)
    with pytest.raises(actions.PackError):
        actions.open_free_pack(user, draft)


def test_odds_follow_the_table(user, published):
    random.seed(7)
    for _ in range(40):
        PackOpening.objects.filter(user=user).delete()
        OwnedCard.objects.filter(owner=user).delete()
        actions.open_free_pack(user, published)
    # After 40 packs (400 cards) commons should clearly dominate. PROVISIONAL odds.
    rarities = list(OwnedCard.objects.filter(owner=user).values_list("card__rarity", flat=True))
    assert rarities.count("common") > len(rarities) * 0.45
    assert rarities.count("legendary") < len(rarities) * 0.1


def test_missing_rarity_falls_back_to_lower_tier(user):
    card_set = make_set(user)
    fill_publishable(card_set, n_common=5, extra=())
    publish_set(card_set)
    card_set.refresh_from_db()
    opening = actions.open_free_pack(user, card_set)
    assert {c.card.rarity for c in opening.cards.all()} == {"common"}


def test_recycle_duplicate_earns_points_and_buys_packs(user, published):
    card = published.cards.filter(rarity="rare").first()
    copies = [OwnedCard.objects.create(owner=user, card=card) for _ in range(6)]

    balance = actions.recycle_card(user, copies[0])
    assert balance == 10
    assert not OwnedCard.objects.filter(pk=copies[0].pk).exists()

    for copy in copies[1:5]:
        balance = actions.recycle_card(user, copy)
    assert balance == 50

    # The last copy is no longer a duplicate.
    with pytest.raises(actions.PackError, match="duplicates"):
        actions.recycle_card(user, copies[5])

    opening = actions.open_pack_with_points(user, published)
    assert opening.kind == "points"
    assert actions.points_balance(user, published) == 0
    with pytest.raises(actions.PackError, match="need 50 points"):
        actions.open_pack_with_points(user, published)


def test_cannot_recycle_someone_elses_card(user, published):
    other = make_user()
    card = published.cards.first()
    theirs = OwnedCard.objects.create(owner=other, card=card)
    OwnedCard.objects.create(owner=other, card=card)
    with pytest.raises(actions.PackError):
        actions.recycle_card(user, theirs)


def test_points_are_specific_to_the_set(user, published):
    other = make_set(user, title="Other")
    fill_publishable(other)
    publish_set(other)
    other.refresh_from_db()
    SetPoints.objects.create(user=user, card_set=other, balance=500)
    with pytest.raises(actions.PackError):
        actions.open_pack_with_points(user, published)


def _race_each(fns):
    """Run each function at once; return its exception, or None for success."""
    results = [None] * len(fns)
    barrier = threading.Barrier(len(fns))

    def run(i, fn):
        try:
            barrier.wait()
            fn()
        except Exception as exc:  # noqa: BLE001 - we want whatever the DB throws
            results[i] = exc
        finally:
            connection.close()

    threads = [threading.Thread(target=run, args=(i, fn)) for i, fn in enumerate(fns)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    return results


def _race(fn, n=2):
    return _race_each([fn] * n)


@pytest.mark.django_db(transaction=True)
def test_concurrent_free_pack_requests_only_open_one():
    user = make_user()
    card_set = make_set(user)
    fill_publishable(card_set)
    publish_set(card_set)
    card_set.refresh_from_db()

    results = _race(lambda: actions.open_free_pack(user, card_set))

    assert PackOpening.objects.filter(user=user).count() == 1
    assert OwnedCard.objects.filter(owner=user).count() == actions.PACK_SIZE
    assert sum(isinstance(r, actions.PackError) for r in results) == 1


@pytest.mark.django_db(transaction=True)
def test_concurrent_recycling_preserves_the_final_copy():
    user = make_user()
    card_set = make_set(user)
    fill_publishable(card_set)
    publish_set(card_set)
    card = card_set.cards.first()
    copies = [OwnedCard.objects.create(owner=user, card=card) for _ in range(2)]

    results = _race_each(
        [
            lambda: actions.recycle_card(user, copies[0]),
            lambda: actions.recycle_card(user, copies[1]),
        ]
    )

    assert OwnedCard.objects.filter(owner=user, card=card).count() == 1
    assert actions.points_balance(user, card_set) == 1
    assert sum(isinstance(r, actions.PackError) for r in results) == 1


@pytest.mark.django_db(transaction=True)
def test_recycle_and_create_offer_race_resolves_one_way():
    creator = make_user()
    card_set = make_set(creator)
    fill_publishable(card_set)
    publish_set(card_set)
    cards = list(card_set.cards.all())
    alice, bob = make_user(username="alice"), make_user(username="bob")
    offered = OwnedCard.objects.create(owner=alice, card=cards[0])
    duplicate = OwnedCard.objects.create(owner=alice, card=cards[0])
    wanted = OwnedCard.objects.create(owner=bob, card=cards[1])

    results = _race_each(
        [
            lambda: actions.recycle_card(alice, offered),
            lambda: trades.create_offer(alice, bob, [offered.id], [wanted.id]),
        ]
    )

    assert sum(r is None for r in results) == 1
    assert all(r is None or isinstance(r, (actions.PackError, trades.TradeError)) for r in results)
    pending = TradeOffer.objects.filter(status=TradeOffer.Status.PENDING).exists()
    recycled = not OwnedCard.objects.filter(pk=offered.pk).exists()
    assert pending != recycled
    assert OwnedCard.objects.filter(pk=duplicate.pk, owner=alice).exists()
    assert actions.points_balance(alice, card_set) == (1 if recycled else 0)


@pytest.mark.django_db(transaction=True)
def test_concurrent_points_spend_cannot_overdraw():
    user = make_user()
    card_set = make_set(user)
    fill_publishable(card_set)
    publish_set(card_set)
    card_set.refresh_from_db()
    SetPoints.objects.create(user=user, card_set=card_set, balance=actions.EXTRA_PACK_POINT_COST)

    results = _race(lambda: actions.open_pack_with_points(user, card_set))

    assert PackOpening.objects.filter(user=user, kind="points").count() == 1
    assert SetPoints.objects.get(user=user, card_set=card_set).balance == 0
    assert sum(isinstance(r, actions.PackError) for r in results) == 1
