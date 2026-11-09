import math
import re

import pytest
from django.urls import reverse

from cards import embeddings, tag_groups
from cards.models import EMBEDDING_DIMENSIONS, CardSet, Tag, TagMergeSuggestion
from cards.publishing import publish_set
from cards.tests.helpers import fill_publishable, make_set

pytestmark = pytest.mark.django_db

# Stand-in for Voyage: words in a group share a direction; other words share a faint one.
GROUPS = {"beach": 0, "seaside": 0, "coast": 0, "shore": 0, "mountain": 1, "summit": 1, "beetle": 2}


def fake_embed(texts, input_type):
    vectors = []
    for text in texts:
        vector = [0.0] * EMBEDDING_DIMENSIONS
        for word in re.findall(r"[a-z]+", text.lower()):
            group = GROUPS.get(word.rstrip("s"))
            if group is None:
                vector[100] += 0.05
            else:
                vector[group] += 1.0
        norm = math.sqrt(sum(v * v for v in vector)) or 1.0
        vectors.append([v / norm for v in vector])
    return vectors


@pytest.fixture
def meaning(settings, monkeypatch):
    settings.VOYAGE_API_KEY = "test-key"
    calls = []

    def recording_embed(texts, input_type):
        calls.append(len(texts))
        return fake_embed(texts, input_type)

    monkeypatch.setattr(embeddings, "embed", recording_embed)
    embeddings._query_vector.cache_clear()
    yield calls
    embeddings._query_vector.cache_clear()


def published(user, title, **fields):
    card_set = make_set(user, title=title, **fields)
    fill_publishable(card_set)
    publish_set(card_set)
    card_set.refresh_from_db()
    return card_set


def test_search_finds_sets_by_meaning_when_embeddings_are_on(api_client, user, meaning):
    beach = published(user, "Summer at the Beach")
    published(user, "Mountain Huts")
    embeddings.refresh()

    found = api_client.get(reverse("social:search"), {"q": "seaside"}).json()
    assert [s["slug"] for s in found["sets"]] == [beach.slug]


def test_search_without_a_key_or_with_a_failing_service_still_works(
    api_client, user, settings, monkeypatch
):
    published(user, "Summer at the Beach")
    settings.VOYAGE_API_KEY = ""
    assert api_client.get(reverse("social:search"), {"q": "seaside"}).json()["sets"] == []

    settings.VOYAGE_API_KEY = "test-key"
    embeddings._query_vector.cache_clear()

    def down(texts, input_type):
        raise embeddings.EmbeddingError("timed out")

    monkeypatch.setattr(embeddings, "embed", down)
    found = api_client.get(reverse("social:search"), {"q": "beach"}).json()
    assert [s["title"] for s in found["sets"]] == ["Summer at the Beach"]


def test_refresh_embeds_findable_rows_once_and_drops_hidden_ones(user, meaning):
    card_set = published(user, "Summer at the Beach")
    make_set(user, title="Unpublished Draft")
    counts = embeddings.refresh()
    assert counts["sets"] == 1 and counts["cards"] == card_set.cards.count()
    assert embeddings.refresh(sweep=True) == {"sets": 0, "cards": 0, "tags": 0, "dropped": 0}

    CardSet.objects.filter(pk=card_set.pk).update(status=CardSet.Status.HIDDEN)
    assert embeddings.refresh()["dropped"] == 1 + card_set.cards.count()
    assert CardSet.objects.get(pk=card_set.pk).embedding is None


def test_changing_tags_queues_a_set_for_re_embedding(auth_client, user, meaning):
    card_set = published(user, "Summer at the Beach")
    embeddings.refresh()
    auth_client.put(
        reverse("cards:my-set-tags", args=[card_set.id]), {"tags": ["Coast"]}, format="json"
    )
    assert CardSet.objects.get(pk=card_set.pk).embedding_hash == ""
    assert embeddings.refresh()["sets"] == 1


def test_merge_suggestions_pair_close_tags_once(auth_client, user, meaning):
    big = published(user, "Summer at the Beach")
    small = published(user, "Rock Pools")
    other = published(user, "Garden Beetles")
    auth_client.put(reverse("cards:my-set-tags", args=[big.id]), {"tags": ["Beach"]}, format="json")
    auth_client.put(
        reverse("cards:my-set-tags", args=[other.id]), {"tags": ["Beach", "Beetles"]}, format="json"
    )
    auth_client.put(
        reverse("cards:my-set-tags", args=[small.id]), {"tags": ["Seaside"]}, format="json"
    )
    embeddings.refresh()

    assert tag_groups.suggest_merges() == 1
    suggestion = TagMergeSuggestion.objects.get()
    assert (suggestion.tag.slug, suggestion.into.slug) == ("seaside", "beach")

    suggestion.status = TagMergeSuggestion.Status.DISMISSED
    suggestion.save()
    assert tag_groups.suggest_merges() == 0


def test_studio_tag_suggestions_include_tags_with_the_same_meaning(
    auth_client, api_client, user, meaning
):
    card_set = published(user, "Summer at the Beach")
    auth_client.put(
        reverse("cards:my-set-tags", args=[card_set.id]), {"tags": ["Beach"]}, format="json"
    )
    Tag.objects.create(slug="mountains", label="Mountains")
    embeddings.refresh()

    offered = api_client.get(reverse("cards:tags"), {"q": "seaside"}).json()
    assert offered == [{"slug": "beach", "label": "Beach", "set_count": 1}]
