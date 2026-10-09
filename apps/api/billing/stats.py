from datetime import UTC, timedelta
from typing import Any

from django.conf import settings
from django.db.models import Count, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from cards.models import CardDefinition, CardSet
from packs.models import OwnedCard, PackOpening
from social.models import SetFollow

from .actions import active_period, publishing_summary
from .models import StarEntry


def creator_stats(user) -> dict[str, Any]:
    sets = CardSet.objects.filter(creator=user, published_at__isnull=False)
    openings = PackOpening.objects.filter(card_set__creator=user)
    followers = SetFollow.objects.filter(card_set__creator=user)
    advanced = bool(settings.MONETIZATION_ENABLED and active_period(user))
    result: dict[str, Any] = {
        "enabled": settings.MONETIZATION_ENABLED,
        "advanced": advanced,
        "publishing": publishing_summary(user),
        "totals": {
            "sets": sets.count(),
            "openings": openings.count(),
            "collectors": openings.values("user_id").distinct().count(),
            "follows": followers.count(),
        },
    }
    if not advanced:
        return result
    since = timezone.now().astimezone(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    since -= timedelta(days=29)
    rewards = StarEntry.objects.filter(user=user, kind=StarEntry.Kind.REWARD)
    opening_counts: dict[Any, Any] = {
        row["card_set_id"]: row
        for row in openings.order_by()
        .values("card_set_id")
        .annotate(
            openings=Count("pk"),
            collectors=Count("user_id", distinct=True),
            stars_spent_units=Sum("stars_spent_units"),
        )
    }
    follow_counts = dict(
        followers.order_by()
        .values("card_set_id")
        .annotate(total=Count("pk"))
        .values_list("card_set_id", "total")
    )
    reward_counts = dict(
        rewards.order_by()
        .values("opening__card_set_id")
        .annotate(total=Sum("units"))
        .values_list("opening__card_set_id", "total")
    )
    card_counts = dict(
        CardDefinition.objects.filter(card_set__in=sets)
        .order_by()
        .values("card_set_id")
        .annotate(total=Count("pk"))
        .values_list("card_set_id", "total")
    )
    progress: dict[Any, dict[str, int]] = {}
    holdings = (
        OwnedCard.objects.filter(card__card_set__in=sets)
        .order_by()
        .values("card__card_set_id", "owner_id")
        .annotate(unique_cards=Count("card_id", distinct=True))
    )
    for holding in holdings.iterator(chunk_size=2000):
        set_id = holding["card__card_set_id"]
        summary = progress.setdefault(set_id, {"holders": 0, "completed": 0, "unique_cards": 0})
        summary["holders"] += 1
        summary["unique_cards"] += holding["unique_cards"]
        summary["completed"] += int(holding["unique_cards"] == card_counts[set_id])
    popular_cards = (
        CardDefinition.objects.filter(
            card_set__creator=user, card_set__status=CardSet.Status.PUBLISHED
        )
        .annotate(likes=Count("reactions"))
        .filter(likes__gt=0)
        .order_by("-likes", "card_set__title", "position")
        .values("id", "title", "position", "card_set__slug", "card_set__title", "likes")[:5]
    )
    result["details"] = {
        "since": since,
        "includes_own_activity": True,
        "stars_earned_units": rewards.aggregate(total=Sum("units"))["total"] or 0,
        "recent_stars_earned_units": rewards.filter(created_at__gte=since).aggregate(
            total=Sum("units")
        )["total"]
        or 0,
        "recent_openings": openings.filter(opened_at__gte=since).count(),
        "daily_openings": list(
            openings.filter(opened_at__gte=since)
            .order_by()
            .annotate(day=TruncDate("opened_at"))
            .values("day")
            .annotate(openings=Count("pk"))
            .order_by("day")
        ),
        "opening_types": list(
            openings.order_by().values("kind").annotate(openings=Count("pk")).order_by("kind")
        ),
        "popular_cards": [
            {
                "id": str(card["id"]),
                "title": card["title"],
                "position": card["position"],
                "set_slug": card["card_set__slug"],
                "set_title": card["card_set__title"],
                "likes": card["likes"],
            }
            for card in popular_cards
        ],
        "sets": [
            {
                "id": str(card_set.pk),
                "title": card_set.title,
                "slug": card_set.slug,
                "deleted": card_set.deleted_at is not None,
                "openings": opening_counts.get(card_set.pk, {}).get("openings", 0),
                "collectors": opening_counts.get(card_set.pk, {}).get("collectors", 0),
                "stars_spent_units": opening_counts.get(card_set.pk, {}).get("stars_spent_units", 0)
                or 0,
                "follows": follow_counts.get(card_set.pk, 0),
                "stars_earned_units": reward_counts.get(card_set.pk, 0),
                "holders": progress.get(card_set.pk, {}).get("holders", 0),
                "completed": progress.get(card_set.pk, {}).get("completed", 0),
                "average_completion_percent": round(
                    100
                    * progress.get(card_set.pk, {}).get("unique_cards", 0)
                    / max(
                        1,
                        card_counts.get(card_set.pk, 0)
                        * progress.get(card_set.pk, {}).get("holders", 0),
                    ),
                    1,
                ),
            }
            for card_set in sets.order_by("-published_at")
        ],
    }
    return result
