from django.db.models import Q

from .models import Block


def blocked_ids(user) -> set:
    """Everyone this person has blocked or been blocked by."""
    if user is None or not user.is_authenticated:
        return set()
    links = Block.objects.filter(Q(user=user) | Q(blocked=user)).values_list(
        "user_id", "blocked_id"
    )
    return {other if owner == user.pk else owner for owner, other in links}


def between(first, second) -> bool:
    if first is None or second is None:
        return False
    return Block.objects.filter(
        Q(user=first, blocked=second) | Q(user=second, blocked=first)
    ).exists()
