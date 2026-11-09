"""Ranking for the search box. Each source (words, title text, tags) returns a
bounded list of candidates from its own index, the scores are blended, and only
the winners are loaded, so the cost stays flat as sets and cards grow."""

from django.contrib.postgres.search import SearchQuery, SearchRank
from django.db.models import F, QuerySet

from .models import CardDefinition, CardSet, CardTag, SetTag

CANDIDATES = 200
TITLE_WEIGHT = 1.0
TAG_WEIGHT = 0.5


def _blend(scores: dict, ids, weight: float) -> None:
    for pk in ids:
        scores[pk] = scores.get(pk, 0.0) + weight


def _ranked(base: QuerySet, query: SearchQuery, q: str, tagged_ids: list) -> dict:
    scores: dict = {}
    words = (
        base.filter(search_vector=query)
        .annotate(rank=SearchRank(F("search_vector"), query))
        .order_by("-rank")
        .values_list("pk", "rank")[:CANDIDATES]
    )
    for pk, rank in words:
        scores[pk] = scores.get(pk, 0.0) + rank
    _blend(
        scores,
        base.filter(title__icontains=q).values_list("pk", flat=True)[:CANDIDATES],
        TITLE_WEIGHT,
    )
    _blend(scores, tagged_ids, TAG_WEIGHT)
    return scores


def sets(q: str, tag_slugs: list[str]) -> dict:
    """Published set ids to scores, best first when sorted."""
    base = CardSet.objects.filter(status=CardSet.Status.PUBLISHED)
    tagged = (
        SetTag.objects.filter(tag__slug__in=tag_slugs, card_set__status=CardSet.Status.PUBLISHED)
        .values_list("card_set_id", flat=True)
        .distinct()[:CANDIDATES]
        if tag_slugs
        else []
    )
    return _ranked(base, SearchQuery(q, search_type="websearch", config="english"), q, list(tagged))


def cards(q: str, tag_slugs: list[str]) -> dict:
    """Card ids from published sets to scores."""
    base = CardDefinition.objects.filter(card_set__status=CardSet.Status.PUBLISHED)
    tagged = (
        CardTag.objects.filter(
            tag__slug__in=tag_slugs, card__card_set__status=CardSet.Status.PUBLISHED
        )
        .values_list("card_id", flat=True)
        .distinct()[:CANDIDATES]
        if tag_slugs
        else []
    )
    return _ranked(base, SearchQuery(q, search_type="websearch", config="english"), q, list(tagged))


def best(scores: dict, limit: int) -> list:
    return sorted(scores, key=lambda pk: -scores[pk])[:limit]
