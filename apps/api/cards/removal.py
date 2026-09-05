from django.db import transaction

from packs.models import OwnedCard
from trades.models import TradeOffer

from .models import CardSet


def remove_set(card_set: CardSet) -> int:
    """Platform removal for a serious Terms violation: the set and every
    distributed copy disappear. Pending trades touching those copies are
    cancelled. Returns the number of copies wiped.

    A creator's own voluntary delete is CardSet.soft_delete(), which keeps copies.
    """
    with transaction.atomic():
        copies = OwnedCard.objects.filter(card__card_set=card_set)
        TradeOffer.objects.filter(
            status=TradeOffer.Status.PENDING, items__owned_card__in=copies
        ).distinct().update(status=TradeOffer.Status.CANCELLED)
        _, by_model = copies.delete()
        card_set.soft_delete(removed_by_platform=True)
    return by_model.get("packs.OwnedCard", 0)
