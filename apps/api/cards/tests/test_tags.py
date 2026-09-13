import threading

import pytest
from django.db import connection
from django.urls import reverse

from cards.models import Tag
from cards.publishing import publish_set
from cards.tags import normalised, slugify_tag
from cards.tests.helpers import fill_publishable, make_set
from conftest import make_user

pytestmark = pytest.mark.django_db


@pytest.fixture
def published(user):
    card_set = make_set(user, title="Garden Beetles")
    fill_publishable(card_set)
    publish_set(card_set)
    card_set.refresh_from_db()
    return card_set


def test_slugify_folds_spelling_into_one_tag():
    assert slugify_tag("Field Guide") == slugify_tag("field-guide") == "field-guide"
    assert slugify_tag("  Rocks & Minerals  ") == "rocks-minerals"
    assert slugify_tag("!!") == ""
    assert len(slugify_tag("a" * 60)) == 30


def test_normalised_drops_repeats_and_keeps_the_order_given():
    assert normalised(["Beetles", "beetles", "Garden", "!"], 8) == [
        ("beetles", "Beetles"),
        ("garden", "Garden"),
    ]


def test_setting_and_replacing_a_sets_tags(auth_client, user, published):
    url = reverse("cards:my-set-tags", args=[published.id])
    body = auth_client.put(url, {"tags": ["Beetles", "garden", "UK"]}, format="json").json()
    assert [t["slug"] for t in body] == ["beetles", "garden", "uk"]
    assert [t["label"] for t in body] == ["Beetles", "garden", "UK"]

    body = auth_client.put(url, {"tags": ["insects"]}, format="json").json()
    assert [t["slug"] for t in body] == ["insects"]

    detail = auth_client.get(reverse("cards:public-set", args=[published.slug])).json()
    assert detail["tags"] == [{"slug": "insects", "label": "insects"}]


def test_tags_stay_editable_after_publishing_but_only_by_the_creator(api_client, user, published):
    url = reverse("cards:my-set-tags", args=[published.id])
    api_client.force_authenticate(make_user(username="stranger"))
    assert api_client.put(url, {"tags": ["mine"]}, format="json").status_code == 404

    api_client.force_authenticate(user)
    assert api_client.put(url, {"tags": ["beetles"]}, format="json").status_code == 200


def test_tag_limits_and_unusable_tags_are_refused(auth_client, published):
    url = reverse("cards:my-set-tags", args=[published.id])
    response = auth_client.put(url, {"tags": ["a"] * 9}, format="json")
    assert response.status_code == 400
    assert "Up to 8 tags." in response.json()["fields"]["tags"]

    response = auth_client.put(url, {"tags": ["!!"]}, format="json")
    assert response.status_code == 400


def test_card_tags(auth_client, user, published):
    card = published.cards.first()
    url = reverse("cards:my-card-tags", args=[published.id, card.id])
    body = auth_client.put(url, {"tags": ["Stag Beetle", "macro"]}, format="json").json()
    assert [t["slug"] for t in body] == ["stag-beetle", "macro"]
    assert auth_client.put(url, {"tags": ["a"] * 6}, format="json").status_code == 400

    detail = auth_client.get(reverse("cards:public-set", args=[published.slug])).json()
    tagged = next(c for c in detail["cards"] if c["id"] == str(card.id))
    assert [t["slug"] for t in tagged["tags"]] == ["stag-beetle", "macro"]


def test_browsing_and_searching_by_tag(auth_client, api_client, user, published):
    other = make_set(user, title="Backyard Rocks")
    fill_publishable(other)
    publish_set(other)
    auth_client.put(
        reverse("cards:my-set-tags", args=[published.id]), {"tags": ["Beetles"]}, format="json"
    )

    listed = api_client.get(reverse("cards:public-sets"), {"tag": "Beetles"}).json()
    assert [s["slug"] for s in listed["results"]] == [published.slug]

    found = api_client.get(reverse("social:search"), {"q": "beetles"}).json()
    assert found["tags"] == [{"slug": "beetles", "label": "Beetles", "set_count": 1}]
    assert [s["slug"] for s in found["sets"]] == [published.slug]

    catalogue = api_client.get(reverse("cards:tags")).json()
    assert catalogue == [{"slug": "beetles", "label": "Beetles", "set_count": 1}]


def test_a_tag_is_shared_rather_than_copied(auth_client, user, published):
    other = make_set(user, title="Backyard Rocks")
    fill_publishable(other)
    publish_set(other)
    for card_set in (published, other):
        auth_client.put(
            reverse("cards:my-set-tags", args=[card_set.id]),
            {"tags": ["Macro Photography"]},
            format="json",
        )
    assert Tag.objects.filter(slug="macro-photography").count() == 1


@pytest.mark.django_db(transaction=True)
def test_concurrent_tag_writes_do_not_collide():
    """Replacing a tag list clears it before inserting, so two writes landing at
    once must take turns rather than both clearing and then colliding."""
    from cards.views import apply_tags

    user = make_user()
    card_set = make_set(user, title="Garden Beetles")
    fill_publishable(card_set)
    publish_set(card_set)

    failures: list[Exception] = []
    barrier = threading.Barrier(2)

    def write(labels):
        def run():
            try:
                barrier.wait()
                apply_tags(card_set, labels, 8)
            except Exception as exc:  # noqa: BLE001 - we want whatever the DB throws
                failures.append(exc)
            finally:
                connection.close()

        return run

    threads = [
        threading.Thread(target=write(["beetles", "garden"])),
        threading.Thread(target=write(["beetles", "macro"])),
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert failures == []
    slugs = set(Tag.objects.filter(set_tags__card_set=card_set).values_list("slug", flat=True))
    assert slugs in ({"beetles", "garden"}, {"beetles", "macro"})
