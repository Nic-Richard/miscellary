"""Ranking for the search box. Each source (words, title text, tags and, when
embeddings are on, meaning) returns a bounded list of candidates from its own
index, the scores are blended, and only the winners are loaded, so the cost
stays flat as sets and cards grow."""

from django.contrib.postgres.search import SearchQuery, SearchRank
from django.db.models import F, QuerySet
from pgvector import HalfVector
from pgvector.django import CosineDistance

from .models import CardDefinition, CardSet, CardTag, SetTag

CANDIDATES = 200
TITLE_WEIGHT = 1.0
TAG_WEIGHT = 0.5
MEANING_WEIGHT = 1.0
# Cosine similarity below this is noise rather than a related subject.
MEANING_MIN = 0.35


def _blend(scores: dict, ids, weight: float) -> None:
    for pk in ids:
        scores[pk] = scores.get(pk, 0.0) + weight


def _ranked(
    base: QuerySet, query: SearchQuery, q: str, tagged_ids: list, vector: list[float] | None
) -> dict:
    scores: dict = {}
    if vector is not None:
        nearest = (
            base.filter(embedding__isnull=False)
            .annotate(distance=CosineDistance("embedding", HalfVector(vector)))
            .order_by("distance")
            .values_list("pk", "distance")[:CANDIDATES]
        )
        for pk, distance in nearest:
            if 1 - distance >= MEANING_MIN:
                scores[pk] = MEANING_WEIGHT * (1 - distance)
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


def sets(q: str, tag_slugs: list[str], vector: list[float] | None = None) -> dict:
    """Published set ids to scores, best first when sorted."""
    base = CardSet.objects.filter(status=CardSet.Status.PUBLISHED)
    tagged = (
        SetTag.objects.filter(tag__slug__in=tag_slugs, card_set__status=CardSet.Status.PUBLISHED)
        .values_list("card_set_id", flat=True)
        .distinct()[:CANDIDATES]
        if tag_slugs
        else []
    )
    query = SearchQuery(q, search_type="websearch", config="english")
    return _ranked(base, query, q, list(tagged), vector)


def cards(q: str, tag_slugs: list[str], vector: list[float] | None = None) -> dict:
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
    query = SearchQuery(q, search_type="websearch", config="english")
    return _ranked(base, query, q, list(tagged), vector)


def best(scores: dict, limit: int) -> list:
    return sorted(scores, key=lambda pk: -scores[pk])[:limit]
