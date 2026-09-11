from django.db import IntegrityError, transaction
from django.utils import timezone

from .identity import next_set_suffix, suggest_set_code
from .models import CardDefinition, CardSet
from .rarity import MIN_CARDS_TO_PUBLISH, rarity_problems

# The unique constraint resolves concurrent suffix allocation.
SUFFIX_ATTEMPTS = 12


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
        card_set = CardSet.objects.select_for_update().get(pk=card_set.pk)
        problems = publish_problems(card_set)
        if problems:
            return problems
        _allocate_printed_code(card_set)
        CardDefinition.objects.filter(card_set=card_set).update(set_total=card_set.cards.count())
        card_set.status = CardSet.Status.PUBLISHED
        card_set.published_at = timezone.now()
        card_set.save(update_fields=["status", "published_at"])
    return []


def _allocate_printed_code(card_set: CardSet) -> None:
    base = card_set.set_code or suggest_set_code(card_set.title)
    for _ in range(SUFFIX_ATTEMPTS):
        taken = set(
            CardSet.objects.filter(set_code=base)
            .exclude(set_code_suffix="")
            .values_list("set_code_suffix", flat=True)
        )
        card_set.set_code = base
        card_set.set_code_suffix = next_set_suffix(taken)
        try:
            with transaction.atomic():
                card_set.save(update_fields=["set_code", "set_code_suffix"])
            return
        except IntegrityError:
            continue
    raise IntegrityError(f"Could not allocate a printed code for {base}.")
