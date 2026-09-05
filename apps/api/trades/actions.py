"""Trade offers: create, counter, accept, reject, cancel.

A card sitting in a pending offer is "held": it can't go into another offer or
be recycled. Accepting locks the offer and every card in it, re-checks
ownership, then swaps owners in one transaction.
"""

from django.db import transaction
from django.utils import timezone

from packs.models import OwnedCard

from .models import TradeOffer, TradeOfferItem

MAX_CARDS_PER_SIDE = 20


class TradeError(Exception):
    """User-facing problem with an offer."""


def held_card_ids(card_ids) -> set:
    return set(
        TradeOfferItem.objects.filter(
            owned_card_id__in=card_ids, offer__status=TradeOffer.Status.PENDING
        ).values_list("owned_card_id", flat=True)
    )


def _lock_cards(give_ids, want_ids) -> dict:
    """Lock every card in the offer, in id order, so concurrent offers serialize."""
    ids = list(set(give_ids) | set(want_ids))
    return {
        c.pk: c for c in OwnedCard.objects.select_for_update().filter(id__in=ids).order_by("pk")
    }


def _check_side(cards: dict, owner, card_ids, label: str) -> list[OwnedCard]:
    if len(card_ids) > MAX_CARDS_PER_SIDE:
        raise TradeError(f"At most {MAX_CARDS_PER_SIDE} cards per side.")
    picked = [cards.get(i) for i in set(card_ids)]
    if any(c is None or c.owner_id != owner.id for c in picked):
        raise TradeError(f"Some of the cards {label} aren't available.")
    if held_card_ids(card_ids):
        raise TradeError(f"Some of the cards {label} are already in a pending trade.")
    return [c for c in picked if c is not None]


def create_offer(sender, recipient, give_ids, want_ids, message="", counter_of=None) -> TradeOffer:
    if sender == recipient:
        raise TradeError("You can't trade with yourself.")
    if not give_ids and not want_ids:
        raise TradeError("Pick at least one card.")
    if set(give_ids) & set(want_ids):
        raise TradeError("A card can't be on both sides of an offer.")
    with transaction.atomic():
        cards = _lock_cards(give_ids, want_ids)
        give = _check_side(cards, sender, give_ids, "you're offering")
        want = _check_side(cards, recipient, want_ids, "you asked for")
        offer = TradeOffer.objects.create(
            sender=sender, recipient=recipient, message=message[:200], counter_of=counter_of
        )
        TradeOfferItem.objects.bulk_create(
            [TradeOfferItem(offer=offer, owned_card=c, side="give") for c in give]
            + [TradeOfferItem(offer=offer, owned_card=c, side="want") for c in want]
        )
    return offer


def _close(offer: TradeOffer, status: str) -> None:
    offer.status = status
    offer.resolved_at = timezone.now()
    offer.save(update_fields=["status", "resolved_at"])


def _pending_locked(offer_id) -> TradeOffer:
    offer = TradeOffer.objects.select_for_update().get(pk=offer_id)
    if not offer.is_pending:
        raise TradeError("This offer is no longer open.")
    return offer


def accept_offer(user, offer: TradeOffer) -> TradeOffer:
    stale = False
    with transaction.atomic():
        offer = _pending_locked(offer.pk)
        if offer.recipient_id != user.id:
            raise TradeError("Only the recipient can accept an offer.")

        items = list(offer.items.all())
        # Lock cards in a fixed order so two trades touching the same cards can't deadlock.
        cards = {
            c.pk: c
            for c in OwnedCard.objects.select_for_update()
            .filter(pk__in=[i.owned_card_id for i in items])
            .order_by("pk")
        }
        for item in items:
            card = cards.get(item.owned_card_id)
            expected_owner = offer.sender_id if item.side == "give" else offer.recipient_id
            if card is None or card.owner_id != expected_owner:
                stale = True
                break

        if not stale:
            give_ids = [i.owned_card_id for i in items if i.side == "give"]
            want_ids = [i.owned_card_id for i in items if i.side == "want"]
            OwnedCard.objects.filter(pk__in=give_ids).update(owner=offer.recipient)
            OwnedCard.objects.filter(pk__in=want_ids).update(owner=offer.sender)
            _close(offer, TradeOffer.Status.ACCEPTED)

    if stale:
        # Outside the transaction above so the cancellation sticks after we raise.
        _close(offer, TradeOffer.Status.CANCELLED)
        raise TradeError("A card in this offer changed hands, so the offer was cancelled.")
    return offer


def reject_offer(user, offer: TradeOffer) -> TradeOffer:
    with transaction.atomic():
        offer = _pending_locked(offer.pk)
        if offer.recipient_id != user.id:
            raise TradeError("Only the recipient can reject an offer.")
        _close(offer, TradeOffer.Status.REJECTED)
    return offer


def cancel_offer(user, offer: TradeOffer) -> TradeOffer:
    with transaction.atomic():
        offer = _pending_locked(offer.pk)
        if offer.sender_id != user.id:
            raise TradeError("Only the sender can cancel an offer.")
        _close(offer, TradeOffer.Status.CANCELLED)
    return offer


def counter_offer(user, offer: TradeOffer, give_ids, want_ids, message="") -> TradeOffer:
    """Close the offer and send a new one back the other way."""
    with transaction.atomic():
        offer = _pending_locked(offer.pk)
        if offer.recipient_id != user.id:
            raise TradeError("Only the recipient can counter an offer.")
        _close(offer, TradeOffer.Status.COUNTERED)
        return create_offer(
            user, offer.sender, give_ids, want_ids, message=message, counter_of=offer
        )
