from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from unittest.mock import patch
from uuid import uuid4

import pytest
from django.db import connection, connections
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.lifecycle import delete_account
from billing import actions
from billing.actions import visible_badge
from billing.models import MembershipSettings, StarBalance, StarEntry, StarGrant, SubscriptionPeriod
from billing.stats import creator_stats
from cards.publishing import publish_set
from cards.tests.helpers import fill_publishable, make_set
from conftest import make_user
from packs import actions as packs
from packs.models import OwnedCard, PackOpening, SetPoints
from social.models import Reaction, SetFollow

pytestmark = pytest.mark.django_db


def published(creator):
    card_set = make_set(creator)
    fill_publishable(card_set)
    assert publish_set(card_set) == []
    card_set.refresh_from_db()
    return card_set


def subscribe(user, reference="month-1", starts_at=None, ends_at=None):
    now = timezone.now()
    return actions.grant_subscription_period(
        user,
        "web",
        reference,
        "subscription-1",
        starts_at or now - timedelta(minutes=1),
        ends_at or now + timedelta(days=30),
    )


@pytest.fixture(autouse=True)
def enabled(settings):
    settings.MONETIZATION_ENABLED = True


def test_bundle_receipt_replay_and_account_binding(user):
    first = actions.grant_bundle(user, "web", "payment-1", "credits_125")
    assert actions.grant_bundle(user, "web", "payment-1", "credits_125").pk == first.pk
    assert StarBalance.objects.get(user=user).units == 125000
    assert StarEntry.objects.filter(grant=first).count() == 1
    other = make_user()
    with pytest.raises(actions.BillingError):
        actions.grant_bundle(other, "web", "payment-1", "credits_125")
    with pytest.raises(actions.BillingError):
        actions.grant_bundle(user, "web", "payment-1", "credits_600")
    assert not StarBalance.objects.filter(user=other).exists()


def test_creator_stats_are_private_and_advanced_only_during_paid_period(user, auth_client):
    card_set = published(user)
    buyer = make_user()
    other_set = published(buyer)
    actions.grant_bundle(buyer, "web", "buyer-stars", "credits_125")
    packs.open_pack_with_stars(buyer, card_set, uuid4(), 50000)
    packs.open_free_pack(user, other_set)
    SetFollow.objects.create(user=buyer, card_set=card_set)
    route = reverse("billing:creator-stats")
    assert APIClient().get(route).status_code == 401
    basic = auth_client.get(route).data
    assert basic["totals"] == {"sets": 1, "openings": 1, "collectors": 1, "follows": 1}
    assert "details" not in basic
    period = subscribe(user)
    advanced = auth_client.get(route).data
    assert advanced["details"]["stars_earned_units"] == 10000
    assert advanced["details"]["recent_openings"] == 1
    assert advanced["details"]["daily_openings"][0]["openings"] == 1
    assert advanced["details"]["sets"][0]["id"] == str(card_set.pk)
    assert advanced["details"]["sets"][0]["stars_spent_units"] == 50000
    cards = list(card_set.cards.all())
    OwnedCard.objects.filter(card__card_set=card_set).delete()
    OwnedCard.objects.bulk_create(
        [
            *[OwnedCard(owner=buyer, card=card) for card in cards],
            OwnedCard(owner=user, card=cards[0]),
            OwnedCard(owner=user, card=cards[0]),
        ]
    )
    Reaction.objects.create(user=buyer, card=cards[0])
    Reaction.objects.create(user=user, card=other_set.cards.first())
    with CaptureQueriesContext(connection) as captured:
        advanced = creator_stats(user)
    query_count = len(captured)
    progress = advanced["details"]["sets"][0]
    assert (progress["holders"], progress["completed"]) == (2, 1)
    assert progress["average_completion_percent"] == round(50 + 50 / len(cards), 1)
    assert advanced["details"]["popular_cards"][0]["id"] == str(cards[0].pk)
    assert len(advanced["details"]["popular_cards"]) == 1
    assert advanced["publishing"]["used"] == 1 and advanced["publishing"]["limit"] == 10
    published(user)
    with CaptureQueriesContext(connection) as captured:
        creator_stats(user)
    assert len(captured) == query_count
    card_set.deleted_at = timezone.now()
    card_set.save()
    assert next(
        row for row in creator_stats(user)["details"]["sets"] if row["id"] == str(card_set.pk)
    )["deleted"]
    period.ends_at = timezone.now() - timedelta(seconds=1)
    period.starts_at = period.ends_at - timedelta(days=30)
    period.save()
    assert "details" not in creator_stats(user)


def test_supporter_badge_is_optional_and_expires(user, auth_client, settings):
    assert not visible_badge(user)
    period = subscribe(user)
    assert visible_badge(user)
    route = reverse("billing:membership")
    response = auth_client.patch(route, {"show_badge": False}, format="json")
    assert response.status_code == 200 and not response.data["show_badge"]
    assert not visible_badge(user)
    assert not MembershipSettings.objects.filter(user=make_user()).exists()
    auth_client.patch(route, {"show_badge": True}, format="json")
    assert visible_badge(user)
    settings.MONETIZATION_ENABLED = False
    assert not visible_badge(user)
    settings.MONETIZATION_ENABLED = True
    period.ends_at = timezone.now() - timedelta(seconds=1)
    period.starts_at = period.ends_at - timedelta(days=30)
    period.save()
    assert not visible_badge(user)


def test_mixed_payment_rewards_and_retry(user):
    card_set = published(user)
    buyer = make_user()
    actions.grant_bundle(buyer, "web", "payment-1", "credits_125")
    points = SetPoints.objects.create(user=buyer, card_set=card_set, balance=20)
    request_key = uuid4()
    opening = packs.open_pack_with_stars(buyer, card_set, request_key, 30000)
    assert (opening.points_spent, opening.stars_spent_units) == (20, 30000)
    assert packs.open_pack_with_stars(buyer, card_set, request_key, 30000).pk == opening.pk
    points.refresh_from_db()
    assert points.balance == 0
    assert StarBalance.objects.get(user=buyer).units == 95000
    assert StarBalance.objects.get(user=user).units == 6000
    assert StarEntry.objects.filter(opening=opening).count() == 2
    assert opening.cards.count() == card_set.pack_size
    with pytest.raises(packs.PackError):
        packs.open_bonus_pack(buyer, card_set, request_key)

    buyer_set = published(buyer)
    SetPoints.objects.create(user=user, card_set=buyer_set, balance=44)
    packs.open_pack_with_stars(user, buyer_set, uuid4(), 6000)
    assert StarBalance.objects.get(user=user).units == 0
    assert StarBalance.objects.get(user=buyer).units == 96200


def test_own_set_reward_and_points_only_purchase(user):
    card_set = published(user)
    actions.grant_bundle(user, "web", "payment-1", "credits_125")
    packs.open_pack_with_stars(user, card_set, uuid4(), 50000)
    assert StarBalance.objects.get(user=user).units == 85000
    SetPoints.objects.update_or_create(user=user, card_set=card_set, defaults={"balance": 50})
    opening = packs.open_pack_with_stars(user, card_set, uuid4(), 0)
    assert opening.stars_spent_units == 0
    assert not StarEntry.objects.filter(opening=opening).exists()
    assert StarBalance.objects.get(user=user).units == 85000


def test_quote_and_failed_pull_cannot_consume_balances(user):
    card_set = published(user)
    buyer = make_user()
    actions.grant_bundle(buyer, "web", "payment-1", "credits_125")
    points = SetPoints.objects.create(user=buyer, card_set=card_set, balance=20)
    with pytest.raises(packs.PackError, match="price changed"):
        packs.open_pack_with_stars(buyer, card_set, uuid4(), 10000)
    with (
        patch("packs.actions._pull_cards", side_effect=RuntimeError("Pull failed")),
        pytest.raises(RuntimeError),
    ):
        packs.open_pack_with_stars(buyer, card_set, uuid4(), 30000)
    points.refresh_from_db()
    assert points.balance == 20
    assert StarBalance.objects.get(user=buyer).units == 125000
    assert StarEntry.objects.count() == 1
    assert not PackOpening.objects.exists()


def test_subscription_replay_cancellation_expiry_and_overlap(user):
    period = subscribe(user)
    assert subscribe(user, starts_at=period.starts_at, ends_at=period.ends_at).pk == period.pk
    assert StarBalance.objects.get(user=user).units == 100000
    assert SubscriptionPeriod.objects.count() == 1
    actions.set_auto_renewal(user, "web", "subscription-1", False)
    assert not actions.active_period(user).subscription.auto_renews
    assert actions.active_period(user, period.ends_at - timedelta(microseconds=1)) is not None
    assert actions.active_period(user, period.ends_at) is None
    with pytest.raises(actions.BillingError, match="already have"):
        actions.grant_subscription_period(
            user, "play", "second-payment", "second-subscription", period.starts_at, period.ends_at
        )
    with pytest.raises(actions.BillingError, match="different"):
        subscribe(user, starts_at=period.starts_at, ends_at=period.ends_at + timedelta(days=1))
    next_period = subscribe(user, "month-2", period.ends_at, period.ends_at + timedelta(days=30))
    assert next_period.bonus_packs_remaining == 10
    assert StarBalance.objects.get(user=user).units == 200000


def test_bonus_pack_is_bounded_and_does_not_reward_creator(user):
    card_set = published(user)
    buyer = make_user()
    period = subscribe(buyer)
    request_key = uuid4()
    first = packs.open_bonus_pack(buyer, card_set, request_key)
    assert packs.open_bonus_pack(buyer, card_set, request_key).pk == first.pk
    for _ in range(9):
        packs.open_bonus_pack(buyer, card_set, uuid4())
    with pytest.raises(packs.PackError, match="no monthly"):
        packs.open_bonus_pack(buyer, card_set, uuid4())
    period.refresh_from_db()
    assert period.bonus_packs_remaining == 0
    assert not StarBalance.objects.filter(user=user).exists()
    assert StarBalance.objects.get(user=buyer).units == 100000
    assert packs.free_pack_available(buyer, card_set)


def test_monthly_publications_survive_deletion_and_upgrade(user, auth_client):
    sets = [published(user) for _ in range(3)]
    sets[0].soft_delete()
    draft = make_set(user)
    fill_publishable(draft)
    route = reverse("cards:publish", args=[draft.pk])
    check = auth_client.get(route).json()
    assert (
        check["publishing"] == auth_client.get(reverse("billing:membership")).json()["publishing"]
    )
    assert check["publishing"]["used"] == 3 and check["publishing"]["creator_reward_percent"] == 20
    assert "3 set publications" in publish_set(draft)[0]
    subscribe(user)
    check = auth_client.get(route).json()
    assert not check["problems"] and check["publishing"]["limit"] == 10
    assert publish_set(draft) == []
    for _ in range(6):
        published(user)
    assert actions.monthly_publications(user)[:2] == (10, 10)
    next_month = actions.monthly_publications(user)[2]
    assert actions.monthly_publications(user, next_month)[0] == 0


def test_membership_is_private_read_only_and_disabled_by_default(user, auth_client, settings):
    url = reverse("billing:membership")
    assert APIClient().get(url).status_code == 401
    assert auth_client.post(url, {"star_units": 999999}, format="json").status_code == 405
    subscribe(user)
    body = auth_client.get(url).json()
    assert body["currency_name"] == "Stars"
    assert body["star_units"] == 100000
    assert body["subscription"]["active"]
    assert body["publishing"]["limit"] == 10
    settings.MONETIZATION_ENABLED = False
    body = auth_client.get(url).json()
    assert body["publishing"]["limit"] is None
    assert not body["subscription"]["active"]
    card_set = published(user)
    with pytest.raises(packs.PackError, match="not available"):
        packs.open_pack_with_stars(user, card_set, uuid4(), 50000)


def test_pack_api_requires_quote_and_request_key(user, auth_client):
    card_set = published(user)
    actions.grant_bundle(user, "web", "payment-1", "credits_125")
    url = reverse("packs:open", args=[card_set.slug])
    quote = auth_client.get(reverse("packs:status", args=[card_set.slug])).json()["paid_quote"]
    assert quote["star_units"] == 125000
    assert quote["stars_spent_units"] == 50000
    assert sum(row["basis_points"] for row in quote["odds"]) == 10000
    assert all(row["card_count"] > 0 for row in quote["odds"])
    assert auth_client.post(url, {"payment": "stars"}, format="json").status_code == 400
    payload = {"payment": "stars", "request_key": str(uuid4()), "max_stars_units": 50000}
    first = auth_client.post(url, payload, format="json").json()
    second = auth_client.post(url, payload, format="json").json()
    assert first["id"] == second["id"]
    assert StarBalance.objects.get(user=user).units == 85000


def test_pack_quote_matches_missing_rarity_fallback_and_points(user, auth_client, settings):
    card_set = published(user)
    card_set.cards.update(rarity="common")
    SetPoints.objects.create(user=user, card_set=card_set, balance=17)
    url = reverse("packs:status", args=[card_set.slug])
    quote = auth_client.get(url).json()["paid_quote"]
    assert quote["points_spent"] == 17
    assert quote["stars_spent_units"] == 33000
    assert quote["odds"] == [
        {"rarity": "common", "basis_points": 10000, "card_count": card_set.cards.count()}
    ]
    settings.MONETIZATION_ENABLED = False
    assert auth_client.get(url).json()["paid_quote"] is None


def test_closed_accounts_cannot_spend_or_receive_grants(user):
    card_set = published(user)
    subscribe(user)
    delete_account(user)
    assert StarBalance.objects.get(user=user).units == 0
    assert actions.active_period(user) is None
    assert StarEntry.objects.filter(user=user, kind="closure").count() == 1
    with pytest.raises(actions.BillingError, match="closed"):
        actions.grant_bundle(user, "web", "payment-after-closure", "credits_125")
    with pytest.raises(packs.PackError, match="closed"):
        packs.open_pack_with_stars(user, card_set, uuid4(), 50000)


@pytest.mark.django_db(transaction=True)
def test_concurrent_spends_and_receipt_retries_do_not_overdraw():
    creator, buyer = make_user(), make_user()
    card_set = published(creator)
    barrier = Barrier(3)

    def run(fn):
        try:
            barrier.wait()
            return fn()
        except Exception as exc:
            return exc
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(
            pool.map(
                run, [lambda: actions.grant_bundle(buyer, "web", "same-payment", "credits_125")] * 3
            )
        )
    assert all(isinstance(result, StarGrant) for result in results)
    assert StarBalance.objects.get(user=buyer).units == 125000
    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(
            pool.map(run, [lambda: packs.open_pack_with_stars(buyer, card_set, uuid4(), 50000)] * 3)
        )
    assert sum(isinstance(result, packs.PackError) for result in results) == 1
    assert StarBalance.objects.get(user=buyer).units == 25000
    assert StarBalance.objects.get(user=creator).units == 20000
    assert PackOpening.objects.filter(user=buyer).count() == 2
    period = subscribe(buyer)
    key = uuid4()
    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(run, [lambda: packs.open_bonus_pack(buyer, card_set, key)] * 3))
    assert all(isinstance(result, PackOpening) for result in results)
    assert len({result.pk for result in results}) == 1
    period.refresh_from_db()
    assert period.bonus_packs_remaining == 9
    claimants = [make_user() for _ in range(3)]
    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(
            pool.map(
                run,
                [
                    lambda claimant=claimant: actions.grant_bundle(
                        claimant, "web", "contested-payment", "credits_125"
                    )
                    for claimant in claimants
                ],
            )
        )
    assert sum(isinstance(result, actions.BillingError) for result in results) == 2
    assert StarGrant.objects.filter(reference="contested-payment").count() == 1
