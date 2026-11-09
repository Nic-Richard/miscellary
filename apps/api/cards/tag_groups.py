"""Tags that mean the same thing are grouped under one main tag, so finding any
of them finds sets carrying any of them. Groups are one level deep: a synonym
points at its main tag and main tags point nowhere."""

from typing import Any

from django.db import transaction
from django.db.models import Count, OuterRef, Q, QuerySet, Subquery, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

from .models import CardSet, SetTag, Tag, TagMergeSuggestion


def group_slugs(slugs: list[str]) -> list[str]:
    """Every slug in the groups of the given slugs, the slugs themselves included."""
    if not slugs:
        return []
    mains = Tag.objects.filter(slug__in=slugs).values_list("canonical_id", "id")
    main_ids = {canonical or own for canonical, own in mains}
    grouped = Tag.objects.filter(Q(id__in=main_ids) | Q(canonical_id__in=main_ids))
    return sorted(set(slugs) | set(grouped.values_list("slug", flat=True)))


def main_tags_matching(q: str, slug: str) -> QuerySet[Any]:
    """Main tags whose group has a member matching the text, each with the number of
    published sets carrying any tag in the group."""
    hits = Tag.objects.filter(Q(slug__icontains=slug or q) | Q(label__icontains=q))
    main_ids = Coalesce("canonical_id", "id")
    return with_group_counts(
        Tag.objects.filter(canonical__isnull=True, id__in=hits.values(main=main_ids))
    )


def with_group_counts(tags: QuerySet[Tag]) -> QuerySet[Any]:
    counts = (
        SetTag.objects.filter(card_set__status=CardSet.Status.PUBLISHED)
        .annotate(main=Coalesce("tag__canonical_id", "tag_id"))
        .filter(main=OuterRef("pk"))
        .values("main")
        .annotate(n=Count("card_set", distinct=True))
        .values("n")
    )
    return tags.annotate(set_count=Coalesce(Subquery(counts), Value(0)))


@transaction.atomic
def merge(tag: Tag, into: Tag) -> Tag:
    """Make `tag` and its own synonyms point at `into`'s main tag. Returns that main tag."""
    main = into.canonical or into
    if main.pk == tag.pk:
        return main
    Tag.objects.filter(canonical=tag).update(canonical=main)
    tag.canonical = main
    tag.save(update_fields=["canonical"])
    TagMergeSuggestion.objects.filter(
        Q(tag=tag, into=into) | Q(tag=into, into=tag), status=TagMergeSuggestion.Status.PENDING
    ).update(status=TagMergeSuggestion.Status.MERGED, decided_at=timezone.now())
    return main
