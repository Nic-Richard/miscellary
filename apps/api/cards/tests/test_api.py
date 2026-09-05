import pytest
from django.urls import reverse

from cards.models import CardSet
from cards.publishing import publish_set
from cards.tests.helpers import fill_publishable, make_card, make_image, make_set
from conftest import make_user

pytestmark = pytest.mark.django_db


def card_payload(image, **overrides):
    payload = {
        "image_id": str(image.id),
        "title": "Quartz",
        "rarity": "common",
        "description": "Found **behind** the shed.",
        "template_key": "classic",
        "template_config": {"accent": "blue"},
    }
    payload.update(overrides)
    return payload


def test_templates_are_public(api_client):
    response = api_client.get(reverse("cards:templates"))
    assert response.status_code == 200
    keys = [t["key"] for t in response.json()]
    assert "classic" in keys
    assert response.json()[0]["options"]


def test_create_set_and_card(auth_client, user):
    response = auth_client.post(
        reverse("cards:my-sets"),
        {"title": "Backyard Rocks", "description": "Rocks."},
        format="json",
    )
    assert response.status_code == 201
    set_id = response.json()["id"]
    assert response.json()["status"] == "draft"

    image = make_image(user)
    response = auth_client.post(
        reverse("cards:my-cards", args=[set_id]), card_payload(image), format="json"
    )
    assert response.status_code == 201
    card = response.json()
    assert card["image"]["url"].endswith(image.key)
    # Partial config is filled with the template's defaults and versioned.
    assert card["template_config"] == {
        "frame": "dark",
        "accent": "blue",
        "font": "display",
        "texture": "linen",
        "corners": "round",
    }
    assert card["template_version"] == 1


def test_card_validation(auth_client, user):
    card_set = make_set(user)
    other_image = make_image(make_user())
    url = reverse("cards:my-cards", args=[card_set.id])

    response = auth_client.post(url, card_payload(other_image), format="json")
    assert response.status_code == 400
    assert "image_id" in response.json()["fields"]

    image = make_image(user)
    response = auth_client.post(
        url, card_payload(image, description="# No headings"), format="json"
    )
    assert "description" in response.json()["fields"]

    response = auth_client.post(
        url, card_payload(image, template_config={"accent": "neon"}), format="json"
    )
    assert "template_config" in response.json()["fields"]

    response = auth_client.post(url, card_payload(image, rarity="mythic"), format="json")
    assert "rarity" in response.json()["fields"]


def test_edit_and_delete_draft_card(auth_client, user):
    card_set = make_set(user)
    card = make_card(card_set)
    url = reverse("cards:my-card", args=[card_set.id, card.id])

    response = auth_client.patch(url, {"title": "Renamed", "rarity": "rare"}, format="json")
    assert response.status_code == 200
    assert response.json()["title"] == "Renamed"

    assert auth_client.delete(url).status_code == 204
    assert card_set.cards.count() == 0


def test_publish_flow(auth_client, user):
    card_set = make_set(user)
    url = reverse("cards:publish", args=[card_set.id])

    preview = auth_client.get(url)
    assert preview.status_code == 200 and preview.json()["problems"]

    response = auth_client.post(url)
    assert response.status_code == 400
    assert response.json()["problems"]

    fill_publishable(card_set)
    response = auth_client.post(url)
    assert response.status_code == 200
    assert response.json()["status"] == "published"

    # Now every edit path is closed.
    card = card_set.cards.first()
    assert (
        auth_client.patch(
            reverse("cards:my-card", args=[card_set.id, card.id]), {"title": "x"}, format="json"
        ).status_code
        == 400
    )
    assert (
        auth_client.post(
            reverse("cards:my-cards", args=[card_set.id]),
            card_payload(make_image(user)),
            format="json",
        ).status_code
        == 400
    )
    assert (
        auth_client.patch(
            reverse("cards:my-set", args=[card_set.id]), {"title": "x"}, format="json"
        ).status_code
        == 400
    )


def test_published_set_identity_remains_editable(auth_client, user):
    card_set = make_set(user)
    fill_publishable(card_set)
    publish_set(card_set)

    url = reverse("cards:my-set", args=[card_set.id])
    response = auth_client.patch(
        url,
        {"mark": "crystal", "pack_colour": "indigo", "pack_size": 3},
        format="json",
    )
    assert response.status_code == 200
    assert response.json()["mark"] == "crystal"
    assert response.json()["pack_colour"] == "indigo"
    assert response.json()["pack_size"] == 3

    response = auth_client.patch(url, {"title": "Changed after publishing"}, format="json")
    assert response.status_code == 400
    card_set.refresh_from_db()
    assert card_set.title == "Rocks of the Backyard"


def test_public_listing_and_binder(api_client, user):
    draft = make_set(user, title="Draft")
    published = make_set(user, title="Published")
    fill_publishable(published)
    publish_set(published)

    response = api_client.get(reverse("cards:public-sets"))
    assert response.status_code == 200
    titles = [s["title"] for s in response.json()["results"]]
    assert titles == ["Published"]
    assert response.json()["results"][0]["card_count"] == 5
    assert response.json()["results"][0]["creator"]["username"] == user.username

    binder = api_client.get(reverse("cards:public-set", args=[published.slug]))
    assert binder.status_code == 200
    assert len(binder.json()["cards"]) == 5

    assert api_client.get(reverse("cards:public-set", args=[draft.slug])).status_code == 404


def test_creator_can_see_own_draft_binder(auth_client, user):
    draft = make_set(user)
    assert auth_client.get(reverse("cards:public-set", args=[draft.slug])).status_code == 200


def test_other_users_cannot_touch_my_sets(api_client, user):
    card_set = make_set(user)
    api_client.force_authenticate(make_user())
    assert api_client.get(reverse("cards:my-set", args=[card_set.id])).status_code == 404
    assert api_client.delete(reverse("cards:my-set", args=[card_set.id])).status_code == 404


def test_delete_draft_hard_and_published_soft(auth_client, user):
    draft = make_set(user)
    assert auth_client.delete(reverse("cards:my-set", args=[draft.id])).status_code == 204
    assert not CardSet.objects.filter(id=draft.id).exists()

    published = make_set(user)
    fill_publishable(published)
    publish_set(published)
    assert auth_client.delete(reverse("cards:my-set", args=[published.id])).status_code == 204
    published.refresh_from_db()
    assert published.status == CardSet.Status.DELETED
    # Gone from discovery, cards untouched.
    assert auth_client.get(reverse("cards:public-sets")).json()["results"] == []
    assert published.cards.count() == 5
