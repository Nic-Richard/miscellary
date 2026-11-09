"""Meaning vectors for search, from Voyage AI. Everything here is optional: with
no API key nothing is embedded, nothing is called, and search runs on words,
titles and tags alone.

Only rows people can find carry a vector. A row with an empty embedding_hash is
waiting to be embedded; the hash of the text it was built from lets a sweep
skip rows that haven't changed.
"""

import hashlib
import json
import logging
import time
import urllib.error
import urllib.request
from functools import lru_cache

from django.conf import settings
from django.db.models import Prefetch, Q

from .models import EMBEDDING_DIMENSIONS, CardDefinition, CardSet, Tag

log = logging.getLogger(__name__)

URL = "https://api.voyageai.com/v1/embeddings"
BATCH = 128
RETRIES = 8
RETRY_SECONDS = 25


class EmbeddingError(Exception):
    pass


def enabled() -> bool:
    return bool(settings.VOYAGE_API_KEY)


def embed(texts: list[str], input_type: str, *, patient: bool | None = None) -> list[list[float]]:
    """One vector per text, in order. input_type is "document" for stored rows and
    "query" for what someone typed, which Voyage encodes slightly differently."""
    vectors: list[list[float]] = []
    for start in range(0, len(texts), BATCH):
        body = json.dumps(
            {
                "input": texts[start : start + BATCH],
                "model": settings.EMBEDDING_MODEL,
                "input_type": input_type,
                "output_dimension": EMBEDDING_DIMENSIONS,
            }
        ).encode()
        request = urllib.request.Request(
            URL,
            data=body,
            method="POST",
            headers={
                "Authorization": f"Bearer {settings.VOYAGE_API_KEY}",
                "Content-Type": "application/json",
            },
        )
        data = _send(request, patient=input_type == "document" if patient is None else patient)
        vectors.extend(row["embedding"] for row in sorted(data["data"], key=lambda r: r["index"]))
    return vectors


def _send(request: urllib.request.Request, *, patient: bool) -> dict:
    """Stored rows wait out Voyage's rate limit and retry; a search never waits, it just
    goes without meaning."""
    for attempt in range(RETRIES if patient else 1):
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                return json.loads(response.read())
        except urllib.error.HTTPError as exc:
            if exc.code != 429 or not patient or attempt == RETRIES - 1:
                raise EmbeddingError(str(exc)) from exc
            time.sleep(float(exc.headers.get("Retry-After") or RETRY_SECONDS))
        except (urllib.error.URLError, TimeoutError, ValueError) as exc:
            raise EmbeddingError(str(exc)) from exc
    raise EmbeddingError("rate limited")


@lru_cache(maxsize=2048)
def _query_vector(text: str) -> tuple[float, ...]:
    return tuple(embed([text], "query")[0])


def query_vector(text: str) -> list[float] | None:
    """The vector for a search, or None when embeddings are off or the service fails."""
    if not enabled():
        return None
    try:
        return list(_query_vector(text.strip().lower()))
    except EmbeddingError as exc:
        log.warning("Query embedding failed (%s); searching without meaning.", exc)
        return None


def _tag_labels(rows) -> str:
    return ", ".join(row.tag.label for row in rows)


def set_text(card_set: CardSet) -> str:
    parts = [card_set.title, card_set.description, _tag_labels(card_set.set_tags.all())]
    parts.append(", ".join(card.title for card in card_set.cards.all()))
    return "\n".join(part for part in parts if part)


def card_text(card: CardDefinition) -> str:
    parts = [
        card.title,
        card.description,
        card.printed_text,
        _tag_labels(card.card_tags.all()),
        f"From the set {card.card_set.title}",
    ]
    return "\n".join(part for part in parts if part)


def tag_text(tag: Tag) -> str:
    return tag.label


def _digest(text: str) -> str:
    return hashlib.sha256(f"{settings.EMBEDDING_MODEL}\n{text}".encode()).hexdigest()


def _store(rows: list, texts: list[str]) -> int:
    """Embed the rows whose text changed since their last vector. Returns how many were embedded."""
    changed = [
        (row, text)
        for row, text in zip(rows, texts, strict=True)
        if row.embedding_hash != _digest(text)
    ]
    if not changed:
        return 0
    vectors = embed([text for _, text in changed], "document")
    for (row, text), vector in zip(changed, vectors, strict=True):
        row.embedding = vector
        row.embedding_hash = _digest(text)
    type(changed[0][0]).objects.bulk_update(
        [row for row, _ in changed], ["embedding", "embedding_hash"]
    )
    return len(changed)


def _published_sets():
    return CardSet.objects.filter(status=CardSet.Status.PUBLISHED).prefetch_related(
        "set_tags__tag",
        Prefetch("cards", queryset=CardDefinition.objects.only("card_set_id", "title")),
    )


def _published_cards():
    return (
        CardDefinition.objects.filter(card_set__status=CardSet.Status.PUBLISHED)
        .select_related("card_set")
        .prefetch_related("card_tags__tag")
    )


def refresh(*, sweep: bool = False, limit: int = 2000) -> dict:
    """Embed waiting rows, or with sweep every findable row whose text changed, and drop
    vectors from rows that can no longer be found. Safe to run at any time."""
    dropped = (
        CardSet.objects.exclude(status=CardSet.Status.PUBLISHED)
        .filter(embedding__isnull=False)
        .update(embedding=None, embedding_hash="")
    )
    dropped += (
        CardDefinition.objects.exclude(card_set__status=CardSet.Status.PUBLISHED)
        .filter(embedding__isnull=False)
        .update(embedding=None, embedding_hash="")
    )
    counts = {"sets": 0, "cards": 0, "tags": 0, "dropped": dropped}
    if not enabled():
        return counts
    waiting = Q() if sweep else Q(embedding_hash="")
    jobs = (
        ("sets", _published_sets().filter(waiting), set_text),
        ("cards", _published_cards().filter(waiting), card_text),
        ("tags", Tag.objects.filter(waiting), tag_text),
    )
    for name, queryset, text_of in jobs:
        last, seen = None, 0
        while sweep or seen < limit:
            page = (
                queryset.order_by("pk")
                if last is None
                else queryset.order_by("pk").filter(pk__gt=last)
            )
            rows = list(page[:BATCH])
            if not rows:
                break
            counts[name] += _store(rows, [text_of(row) for row in rows])
            last, seen = rows[-1].pk, seen + len(rows)
    return counts


def mark_stale(card_set: CardSet | None = None, card: CardDefinition | None = None) -> None:
    """Queue a set (and its cards, whose text names the set) or a single card for re-embedding."""
    if card_set is not None:
        CardSet.objects.filter(pk=card_set.pk).update(embedding_hash="")
        CardDefinition.objects.filter(card_set=card_set).update(embedding_hash="")
    if card is not None:
        CardDefinition.objects.filter(pk=card.pk).update(embedding_hash="")
