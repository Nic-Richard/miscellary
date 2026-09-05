import pytest
from django.urls import reverse

from cards.publishing import publish_set
from cards.tests.helpers import fill_publishable, make_set
from packs.models import OwnedCard

pytestmark = pytest.mark.django_db


@pytest.fixture
def published(user):
    card_set = make_set(user)
    fill_publishable(card_set, n_common=6, extra=("uncommon", "rare", "epic", "legendary"))
    publish_set(card_set)
    card_set.refresh_from_db()
    return card_set


def test_pack_status_and_open(auth_client, published):
    status_url = reverse("packs:status", args=[published.slug])
    assert auth_client.get(status_url).json()["free_available"] is True

    response = auth_client.post(reverse("packs:open", args=[published.slug]))
    assert response.status_code == 201
    body = response.json()
    assert body["kind"] == "free"
    assert len(body["cards"]) == 10
    assert body["cards"][0]["card"]["image"]["url"]
    assert body["cards"][0]["copies"] >= 1
    assert body["status"]["free_available"] is False

    again = auth_client.post(reverse("packs:open", args=[published.slug]))
    assert again.status_code == 400
    assert "already opened" in again.json()["error"]


def test_open_requires_login(api_client, published):
    assert api_client.post(reverse("packs:open", args=[published.slug])).status_code == 401


def test_collection_and_recycle(auth_client, user, published):
    card = published.cards.first()
    a = OwnedCard.objects.create(owner=user, card=card)
    OwnedCard.objects.create(owner=user, card=card)

    response = auth_client.get(reverse("packs:collection"), {"set": published.slug})
    assert response.status_code == 200
    assert response.json()["count"] == 2
    assert response.json()["results"][0]["copies"] == 2
    assert response.json()["results"][0]["set_slug"] == published.slug

    response = auth_client.post(reverse("packs:recycle", args=[a.id]))
    assert response.status_code == 200
    assert response.json()["points"] == 1

    assert auth_client.get(reverse("packs:points")).json() == [
        {"set_slug": published.slug, "set_title": published.title, "points": 1}
    ]

    # Last copy can't be recycled; other people's cards 404.
    remaining = OwnedCard.objects.get(owner=user)
    assert auth_client.post(reverse("packs:recycle", args=[remaining.id])).status_code == 400


def test_deleted_set_stops_generating_packs(auth_client, published):
    published.soft_delete()
    assert auth_client.get(reverse("packs:status", args=[published.slug])).status_code == 404
    assert auth_client.post(reverse("packs:open", args=[published.slug])).status_code == 404
