from django.db import transaction
from django.utils import timezone

from .models import CardSet
from .rarity import MIN_CARDS_TO_PUBLISH, rarity_problems


def publish_problems(card_set: CardSet) -> list[str]:
    """Everything stopping this draft from being published, in plain English."""
    if not card_set.is_draft:
        return ["This set is already published."]
    cards = list(card_set.cards.select_related("image"))
    problems = []
    if len(cards) < MIN_CARDS_TO_PUBLISH:
        problems.append(f"A set needs at least {MIN_CARDS_TO_PUBLISH} cards to publish.")
    if any(not c.image.ready for c in cards):
        problems.append("Every card needs a finished image upload.")
    problems += rarity_problems([c.rarity for c in cards])
    return problems


def publish_set(card_set: CardSet) -> list[str]:
    """Publish if possible. Returns the list of problems (empty on success)."""
    with transaction.atomic():
        # Lock the row so two publish requests can't race each other.
        card_set = CardSet.objects.select_for_update().get(pk=card_set.pk)
        problems = publish_problems(card_set)
        if problems:
            return problems
        card_set.status = CardSet.Status.PUBLISHED
        card_set.published_at = timezone.now()
        card_set.save(update_fields=["status", "published_at"])
    return []
