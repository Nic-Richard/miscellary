"""Pack opening and duplicate recycling.

Everything that touches balances or creates owned cards runs inside a
transaction with the relevant rows locked, so two requests can't open the
same free pack or spend the same points twice.

PROVISIONAL: pack size, odds, costs and recycle values come from
cards/rarity.py and are placeholders until playtesting.
"""

import random

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from cards.models import CardDefinition, CardSet
from cards.rarity import PULL_ODDS, RARITIES, RECYCLE_VALUE

from .models import OwnedCard, PackOpening, SetPoints

PACK_SIZE = 10  # platform default; a set may choose 1-10
EXTRA_PACK_POINT_COST = 50


class PackError(Exception):
    """Something the user can fix or wait for; the message is shown to them."""


def has_unlimited_packs(user) -> bool:
    """Testing exemption from the daily limit. The setting is empty in production."""
    return user.email in settings.UNLIMITED_PACK_EMAILS


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


def pack_size_for(card_set: CardSet) -> int:
    return card_set.pack_size or PACK_SIZE


def _pull_cards(card_set: CardSet) -> list[CardDefinition]:
    """Pick the set's pack size worth of cards by rarity odds, with replacement."""
    by_rarity: dict[str, list[CardDefinition]] = {r: [] for r in RARITIES}
    for card in card_set.cards.select_related("image"):
        by_rarity[card.rarity].append(card)

    pulls = []
    weights = [PULL_ODDS[r] for r in RARITIES]
    for rarity in random.choices(RARITIES, weights=weights, k=pack_size_for(card_set)):
        # If the set has no card of that rarity, step down until one exists.
        index = RARITIES.index(rarity)
        while index >= 0 and not by_rarity[RARITIES[index]]:
            index -= 1
        pulls.append(random.choice(by_rarity[RARITIES[max(index, 0)]]))
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
