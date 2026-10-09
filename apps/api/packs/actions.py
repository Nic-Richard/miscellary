"""Pack opening and duplicate recycling.

Everything that touches balances or creates owned cards runs inside a
transaction with the relevant rows locked, so two requests can't open the
same free pack or spend the same points twice.

PROVISIONAL: pack size, odds, costs and recycle values come from
cards/rarity.py and are placeholders until playtesting.
"""

import random
from uuid import UUID, uuid4

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from billing import actions as billing
from billing.models import StarBalance, StarEntry
from cards.models import CardDefinition, CardSet
from cards.rarity import PULL_ODDS, RARITIES, RECYCLE_VALUE
from common.monetization import CREDIT_UNITS_PER_CREDIT, creator_reward

from .models import OwnedCard, PackOpening, SetPoints

PACK_SIZE = 10  # platform default; a set may choose 1-10
EXTRA_PACK_POINT_COST = 50


class PackError(Exception):
    """Something the user can fix or wait for; the message is shown to them."""


def has_unlimited_packs(user) -> bool:
    """Testing exemption from the daily limit. Disabled in production."""
    return (
        settings.UNLIMITED_PACKS_FOR_DEMO_ACCOUNTS and user.is_demo
    ) or user.email in settings.UNLIMITED_PACK_EMAILS


def free_pack_available(user, card_set: CardSet) -> bool:
    if has_unlimited_packs(user):
        return True
    return not PackOpening.objects.filter(
        user=user,
        card_set=card_set,
        kind=PackOpening.Kind.FREE,
        opened_on=timezone.now().date(),
    ).exists()


def points_balance(user, card_set: CardSet) -> int:
    row = SetPoints.objects.filter(user=user, card_set=card_set).first()
    return row.balance if row else 0


def paid_pack_quote(user, card_set: CardSet, points: int) -> dict:
    balance = StarBalance.objects.filter(user=user).values_list("units", flat=True).first() or 0
    period = billing.active_period(user)
    counts = {rarity: 0 for rarity in RARITIES}
    for rarity in card_set.cards.values_list("rarity", flat=True):
        counts[rarity] += 1
    odds = {rarity: 0 for rarity in RARITIES}
    for index, rarity in enumerate(RARITIES):
        target = index
        while target >= 0 and not counts[RARITIES[target]]:
            target -= 1
        odds[RARITIES[max(target, 0)]] += round(PULL_ODDS[rarity] * 10000)
    points_spent = min(points, EXTRA_PACK_POINT_COST)
    return {
        "request_key": str(uuid4()),
        "points_spent": points_spent,
        "stars_spent_units": (EXTRA_PACK_POINT_COST - points_spent) * CREDIT_UNITS_PER_CREDIT,
        "star_units": balance,
        "units_per_star": CREDIT_UNITS_PER_CREDIT,
        "bonus_packs_remaining": period.bonus_packs_remaining if period else 0,
        "odds": [
            {"rarity": rarity, "basis_points": odds[rarity], "card_count": counts[rarity]}
            for rarity in RARITIES
            if counts[rarity]
        ],
    }


def pack_size_for(card_set: CardSet) -> int:
    return card_set.pack_size or PACK_SIZE


def _pull_cards(card_set: CardSet, rng: random.Random | None = None) -> list[CardDefinition]:
    """Pick the set's pack size worth of cards by rarity odds, with replacement.

    A seeded generator gives the same pulls every time, which the demo seed uses.
    """
    choices, choice = (rng.choices, rng.choice) if rng else (random.choices, random.choice)
    by_rarity: dict[str, list[CardDefinition]] = {r: [] for r in RARITIES}
    for card in card_set.cards.select_related("image"):
        by_rarity[card.rarity].append(card)

    pulls = []
    weights = [PULL_ODDS[r] for r in RARITIES]
    for rarity in choices(RARITIES, weights=weights, k=pack_size_for(card_set)):
        # If the set has no card of that rarity, step down until one exists.
        index = RARITIES.index(rarity)
        while index >= 0 and not by_rarity[RARITIES[index]]:
            index -= 1
        pulls.append(choice(by_rarity[RARITIES[max(index, 0)]]))
    return pulls


def _open(user, card_set: CardSet, kind: str) -> PackOpening:
    opening = PackOpening.objects.create(
        user=user, card_set=card_set, kind=kind, opened_on=timezone.now().date()
    )
    OwnedCard.objects.bulk_create(
        [OwnedCard(owner=user, card=card, pack_opening=opening) for card in _pull_cards(card_set)]
    )
    return opening


def open_free_pack(user, card_set: CardSet) -> PackOpening:
    if not card_set.is_published:
        raise PackError("This set isn't open for packs.")
    try:
        with transaction.atomic():
            if has_unlimited_packs(user):
                # Clear today's slot so the unique constraint lets another one
                # through. OwnedCard.pack_opening is SET_NULL, so the cards
                # already pulled from it stay in the collection.
                PackOpening.objects.filter(
                    user=user,
                    card_set=card_set,
                    kind=PackOpening.Kind.FREE,
                    opened_on=timezone.now().date(),
                ).delete()
            return _open(user, card_set, PackOpening.Kind.FREE)
    except IntegrityError as exc:
        # The unique constraint fired: today's free pack is already open.
        raise PackError("You've already opened today's free pack for this set.") from exc


def open_pack_with_points(user, card_set: CardSet) -> PackOpening:
    if not card_set.is_published:
        raise PackError("This set isn't open for packs.")
    with transaction.atomic():
        points, _ = SetPoints.objects.select_for_update().get_or_create(
            user=user, card_set=card_set
        )
        if points.balance < EXTRA_PACK_POINT_COST:
            raise PackError(
                f"You need {EXTRA_PACK_POINT_COST} points for an extra pack "
                f"(you have {points.balance})."
            )
        points.balance -= EXTRA_PACK_POINT_COST
        points.save(update_fields=["balance"])
        return _open(user, card_set, PackOpening.Kind.POINTS)


@transaction.atomic
def open_pack_with_stars(
    user, card_set: CardSet, request_key: UUID, max_stars_units: int
) -> PackOpening:
    if (
        not isinstance(request_key, UUID)
        or type(max_stars_units) is not int
        or not 0 <= max_stars_units <= EXTRA_PACK_POINT_COST * CREDIT_UNITS_PER_CREDIT
    ):
        raise PackError("Confirm the Stars amount and purchase request key.")
    if not settings.MONETIZATION_ENABLED:
        raise PackError("Stars packs are not available yet.")
    if not card_set.is_published:
        raise PackError("This set isn't open for packs.")
    accounts = billing.lock_accounts([user.pk, card_set.creator_id])
    buyer = accounts[user.pk]
    if not buyer.is_active:
        raise PackError("This account is closed.")
    existing = PackOpening.objects.filter(user=buyer, request_key=request_key).first()
    if existing:
        if (
            existing.card_set_id != card_set.pk
            or existing.kind != PackOpening.Kind.STARS
            or existing.stars_spent_units > max_stars_units
        ):
            raise PackError("That request belongs to a different pack purchase.")
        return existing
    balance, _ = StarBalance.objects.get_or_create(user=buyer)
    points, _ = SetPoints.objects.select_for_update().get_or_create(user=buyer, card_set=card_set)
    points_spent = min(points.balance, EXTRA_PACK_POINT_COST)
    stars_spent = (EXTRA_PACK_POINT_COST - points_spent) * CREDIT_UNITS_PER_CREDIT
    if stars_spent > max_stars_units:
        raise PackError("The pack price changed. Check the points and Stars before opening.")
    if balance.units < stars_spent:
        raise PackError("You need more Stars or set points for this pack.")
    points.balance -= points_spent
    points.save(update_fields=["balance"])
    opening = _open(buyer, card_set, PackOpening.Kind.STARS)
    opening.request_key = request_key
    opening.points_spent = points_spent
    opening.stars_spent_units = stars_spent
    opening.save(update_fields=["request_key", "points_spent", "stars_spent_units"])
    if stars_spent:
        billing.record_entry(balance, StarEntry.Kind.SPEND, -stars_spent, opening=opening)
        creator = accounts[card_set.creator_id]
        if creator.is_active:
            creator_balance = (
                balance
                if creator.pk == buyer.pk
                else StarBalance.objects.get_or_create(user=creator)[0]
            )
            reward, creator_balance.reward_remainder = creator_reward(
                stars_spent, creator_balance.reward_remainder
            )
            billing.record_entry(creator_balance, StarEntry.Kind.REWARD, reward, opening=opening)
    return opening


@transaction.atomic
def open_bonus_pack(user, card_set: CardSet, request_key: UUID) -> PackOpening:
    if not isinstance(request_key, UUID):
        raise PackError("A purchase request key is required.")
    if not settings.MONETIZATION_ENABLED:
        raise PackError("Bonus packs are not available yet.")
    if not card_set.is_published:
        raise PackError("This set isn't open for packs.")
    buyer = billing.lock_accounts([user.pk])[user.pk]
    if not buyer.is_active:
        raise PackError("This account is closed.")
    existing = PackOpening.objects.filter(user=buyer, request_key=request_key).first()
    if existing:
        if existing.card_set_id != card_set.pk or existing.kind != PackOpening.Kind.BONUS:
            raise PackError("That request belongs to a different pack purchase.")
        return existing
    period = billing.active_period(buyer)
    if period is None or not period.bonus_packs_remaining:
        raise PackError("You have no monthly bonus packs available.")
    period.bonus_packs_remaining -= 1
    period.save(update_fields=["bonus_packs_remaining"])
    opening = _open(buyer, card_set, PackOpening.Kind.BONUS)
    opening.request_key = request_key
    opening.subscription_period = period
    opening.save(update_fields=["request_key", "subscription_period"])
    return opening


def recycle_card(user, owned_card: OwnedCard) -> int:
    """Turn a duplicate into set points. Returns the new balance."""
    with transaction.atomic():
        locked = (
            OwnedCard.objects.select_for_update()
            .select_related("card__card_set")
            .filter(pk=owned_card.pk, owner=user)
            .first()
        )
        if locked is None:
            raise PackError("That card isn't in your collection.")
        copies = OwnedCard.objects.filter(owner=user, card=locked.card).count()
        if copies < 2:
            raise PackError("Only duplicates can be recycled.")
        from trades.actions import held_card_ids  # here, not at the top: import cycle

        if held_card_ids([locked.pk]):
            raise PackError("That card is part of a pending trade.")

        value = RECYCLE_VALUE[locked.card.rarity]
        points, _ = SetPoints.objects.select_for_update().get_or_create(
            user=user, card_set=locked.card.card_set
        )
        points.balance += value
        points.save(update_fields=["balance"])
        locked.delete()
        return points.balance


def recycle_duplicates(user, card_set: CardSet) -> tuple[int, int, int]:
    """Recycle every spare copy from one set, keeping the oldest free copy of each card and
    anything in a pending trade. Returns (recycled, earned, new balance)."""
    from trades.actions import held_card_ids  # here, not at the top: import cycle

    with transaction.atomic():
        copies = list(
            OwnedCard.objects.select_for_update()
            .select_related("card")
            .filter(owner=user, card__card_set=card_set)
            .order_by("card_id", "acquired_at", "pk")
        )
        held = held_card_ids([c.pk for c in copies])
        by_card: dict = {}
        for copy in copies:
            by_card.setdefault(copy.card_id, []).append(copy)
        spare = []
        for group in by_card.values():
            # The oldest free copy stays even beside a held one, which may leave in its trade.
            spare.extend([c for c in group if c.pk not in held][1:])
        points, _ = SetPoints.objects.select_for_update().get_or_create(
            user=user, card_set=card_set
        )
        earned = sum(RECYCLE_VALUE[c.card.rarity] for c in spare)
        if spare:
            OwnedCard.objects.filter(pk__in=[c.pk for c in spare]).delete()
            points.balance += earned
            points.save(update_fields=["balance"])
        return len(spare), earned, points.balance
