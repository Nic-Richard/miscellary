"""Discovery tags for sets and cards.

A tag is identified by its slug, so "Field Guide", "field guide" and
"field-guide" are one tag with whatever label the first creator wrote.

Tags are deliberately not part of the frozen published snapshot: they describe
where a set should be found rather than what it looks like, and a creator has
to be able to correct a misspelled one after publishing.
"""

import re

TAG_MIN_LENGTH = 2
TAG_SLUG_MAX = 30
TAG_LABEL_MAX = 30
SET_TAG_MAX = 8
CARD_TAG_MAX = 5

_SEPARATORS = re.compile(r"[\s_/]+")
_DISALLOWED = re.compile(r"[^a-z0-9-]")
_RUNS = re.compile(r"-{2,}")


def slugify_tag(text: str) -> str:
    slug = _SEPARATORS.sub("-", text.strip().lower())
    slug = _RUNS.sub("-", _DISALLOWED.sub("", slug)).strip("-")
    return slug[:TAG_SLUG_MAX].strip("-")


def clean_label(text: str) -> str:
    return _SEPARATORS.sub(" ", text.strip())[:TAG_LABEL_MAX].strip()


def problems(labels: list[str], limit: int) -> list[str]:
    """What is wrong with a submitted tag list, in user-facing words."""
    found = []
    if len(labels) > limit:
        found.append(f"Up to {limit} tags.")
    slugs = []
    for label in labels:
        slug = slugify_tag(label)
        if len(slug) < TAG_MIN_LENGTH:
            found.append(f"\u201c{label.strip()}\u201d is not a usable tag.")
        else:
            slugs.append(slug)
    if len(set(slugs)) != len(slugs):
        found.append("That list repeats a tag.")
    return found


def normalised(labels: list[str], limit: int) -> list[tuple[str, str]]:
    """Submitted labels as ordered unique (slug, label) pairs."""
    out: list[tuple[str, str]] = []
    seen = set()
    for label in labels:
        slug = slugify_tag(label)
        if len(slug) < TAG_MIN_LENGTH or slug in seen:
            continue
        seen.add(slug)
        out.append((slug, clean_label(label) or slug))
    return out[:limit]
