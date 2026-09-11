import pytest
from django.urls import reverse

from cards import templates
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
        "printed_text": "Behind the shed",
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
    assert response.json()[0]["text"]["title"]["max_length"]


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
    assert card["printed_text"] == "Behind the shed"
    assert card["description"] == "Found **behind** the shed."
    assert card["template_config"] == {
        "stock": "bone",
        "texture": "linen",
        "corners": "round",
        "border": "auto",
        "border_width": "thin",
        "tint": "none",
        "window": "rule",
        "shape": "square",
        "title_typeface": "display",
        "body_typeface": "body",
        "accent": "blue",
        "finish": "matte",
        "treatment": "none",
        "coverage": "spot",
        "pattern": "linear",
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

    text_rules = templates.TEMPLATES_BY_KEY["classic"]["text"]
    over_title = "W" * (text_rules["title"]["max_length"] + 1)
    response = auth_client.post(url, card_payload(image, title=over_title), format="json")
    assert "title" in response.json()["fields"]

    over_printed = "x" * (text_rules["printed"]["max_length"] + 1)
    response = auth_client.post(url, card_payload(image, printed_text=over_printed), format="json")
    assert "printed_text" in response.json()["fields"]

    response = auth_client.post(
        url,
        card_payload(image, template_key="polaroid", printed_text="Not used"),
        format="json",
    )
    assert "printed_text" in response.json()["fields"]


@pytest.mark.parametrize("key", ["classic", "polaroid", "bold", "fieldnote"])
def test_card_editor_options_survive_save_and_publish(auth_client, api_client, user, key):
    card_set = make_set(user)
    config = {
        "stock": "lavender",
        "shape": "arch",
        "border": "copper",
        "border_width": "thick",
    }
    response = auth_client.post(
        reverse("cards:my-cards", args=[card_set.id]),
        card_payload(
            make_image(user),
            template_key=key,
            template_config=config,
            printed_text="" if key == "polaroid" else "Behind the shed",
        ),
        format="json",
    )
    assert response.status_code == 201
    saved = response.json()
    assert saved["template_version"] == 1
    assert saved["template_config"] == {**templates.default_config(key), **config}
    fill_publishable(card_set)
    assert publish_set(card_set) == []
    published = api_client.get(reverse("cards:public-set", args=[card_set.slug])).json()
    card = next(c for c in published["cards"] if c["id"] == saved["id"])
    assert card["template_config"] == saved["template_config"]
    assert card["template_version"] == 1


def test_published_snapshot_ignores_current_editor_defaults(api_client, user, monkeypatch):
    card_set = make_set(user)
    config = {"stock": "bone", "border": "red", "border_width": "thick"}
    card = make_card(card_set, template_key="bold", template_version=2, template_config=config)
    fill_publishable(card_set)
    assert publish_set(card_set) == []
    monkeypatch.setitem(templates.TEMPLATES_BY_KEY["bold"]["options"]["border"], "values", ["gold"])
    monkeypatch.setitem(
        templates.TEMPLATES_BY_KEY["bold"]["options"]["border_width"], "default", "hairline"
    )
    response = api_client.get(reverse("cards:public-set", args=[card_set.slug]))
    assert response.status_code == 200
    snapshot = next(c for c in response.json()["cards"] if c["id"] == str(card.id))
    assert snapshot["template_config"] == config
    assert snapshot["template_version"] == 2


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


def test_published_set_is_completely_immutable(auth_client, user):
    card_set = make_set(user)
    fill_publishable(card_set)
    publish_set(card_set)

    url = reverse("cards:my-set", args=[card_set.id])
    response = auth_client.patch(
        url,
        {"mark": "crystal", "pack_colour": "indigo", "pack_size": 3},
        format="json",
    )
    assert response.status_code == 400

    response = auth_client.patch(url, {"title": "Changed after publishing"}, format="json")
    assert response.status_code == 400
    card_set.refresh_from_db()
    assert card_set.title == "Rocks of the Backyard"
    assert card_set.mark != "crystal"
    assert card_set.pack_colour != "indigo"


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
    assert response.json()["results"][0]["creator"]["is_demo"] is False

    binder = api_client.get(reverse("cards:public-set", args=[published.slug]))
    assert binder.status_code == 200
    assert len(binder.json()["cards"]) == 5
    assert binder.json()["printed_set_code"] == "PUB-01"
    first = binder.json()["cards"][0]
    assert (first["printed_set_code"], first["position"], first["set_total"]) == ("PUB-01", 0, 5)

    assert api_client.get(reverse("cards:public-set", args=[draft.slug])).status_code == 404


def test_set_code_is_editable_on_a_draft_and_validated(auth_client, user):
    card_set = make_set(user, title="Pocket Geology")
    url = reverse("cards:my-set", args=[card_set.id])

    draft = auth_client.get(url).json()
    assert draft["suggested_set_code"] == "POC"
    assert draft["printed_set_code"] == "POC"

    saved = auth_client.patch(url, {"set_code": "geo"}, format="json").json()
    assert (saved["set_code"], saved["printed_set_code"]) == ("GEO", "GEO")
    assert "set_code" in auth_client.patch(url, {"set_code": "GE"}, format="json").json()["fields"]
    assert (
        "set_code" in auth_client.patch(url, {"set_code": "GEOL"}, format="json").json()["fields"]
    )


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
    assert auth_client.get(reverse("cards:public-sets")).json()["results"] == []
    assert published.cards.count() == 5
