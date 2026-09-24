import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import ReservedUsername, User
from cards.models import CardSet
from cards.publishing import publish_set
from cards.tests.helpers import fill_publishable, make_set
from conftest import PASSWORD, make_user
from packs.models import OwnedCard
from social.models import Comment, Follow, Reaction
from trades import actions as trades
from trades.models import TradeOffer

pytestmark = pytest.mark.django_db


def client_for(user: User) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def published_set(creator: User) -> CardSet:
    card_set = make_set(creator)
    fill_publishable(card_set, n_common=4, extra=("rare",))
    publish_set(card_set)
    return card_set


def test_delete_requires_the_password(auth_client, user):
    response = auth_client.post(
        reverse("accounts:delete"), {"current_password": "wrong"}, format="json"
    )
    assert response.status_code == 400
    user.refresh_from_db()
    assert user.is_active


def test_delete_keeps_published_work_under_a_deleted_user(api_client):
    creator, fan = make_user(username="maker"), make_user(username="fan")
    ReservedUsername.objects.create(user=creator, username="oldmaker")
    card_set = published_set(creator)
    draft = make_set(creator)
    card = card_set.cards.first()
    OwnedCard.objects.create(owner=creator, card=card)
    fan_copy = OwnedCard.objects.create(owner=fan, card=card)
    Comment.objects.create(card_set=card_set, author=creator, body="Thanks for collecting.")
    Follow.objects.create(follower=fan, following=creator)
    Reaction.objects.create(user=creator, card_set=card_set)
    creator_copy = OwnedCard.objects.create(owner=creator, card=card)
    offer = trades.create_offer(fan, creator, [fan_copy.id], [creator_copy.id])
    api_client.post(
        reverse("accounts:login"), {"email": creator.email, "password": PASSWORD}, format="json"
    )

    response = client_for(creator).post(
        reverse("accounts:delete"), {"current_password": PASSWORD}, format="json"
    )
    assert response.status_code == 204

    creator.refresh_from_db()
    assert not creator.is_active and creator.deleted_at is not None
    assert creator.username.startswith("deleted_") and "maker" not in creator.email
    assert not creator.has_usable_password()
    assert creator.profile.display_name == ""
    assert not ReservedUsername.objects.filter(username="oldmaker").exists()
    assert api_client.post(reverse("accounts:refresh")).status_code == 401

    card_set.refresh_from_db()
    assert card_set.status == CardSet.Status.PUBLISHED
    assert not CardSet.objects.filter(pk=draft.pk).exists()
    assert OwnedCard.objects.filter(pk=fan_copy.pk, owner=fan).exists()
    assert not OwnedCard.objects.filter(owner=creator).exists()
    assert not Follow.objects.filter(following=creator).exists()
    assert not Reaction.objects.filter(user=creator).exists()
    assert TradeOffer.objects.get(pk=offer.pk).status == TradeOffer.Status.CANCELLED

    detail = api_client.get(reverse("cards:public-set", args=[card_set.slug])).json()
    assert detail["creator"]["deleted"] is True
    thread = api_client.get(reverse("social:comments", args=[card_set.slug])).json()
    assert thread["results"][0]["author"]["deleted"] is True
    assert thread["results"][0]["body"] == "Thanks for collecting."
    assert api_client.get(reverse("social:profile", args=[creator.username])).status_code == 404


def test_deleted_names_and_emails_are_free_again(api_client):
    gone = make_user(username="gone", email="gone@example.com")
    client_for(gone).post(reverse("accounts:delete"), {"current_password": PASSWORD}, format="json")
    response = api_client.post(
        reverse("accounts:register"),
        {"email": "gone@example.com", "username": "gone", "password": "a-long-passphrase-9"},
        format="json",
    )
    assert response.status_code == 201


def test_unverified_collectors_cannot_publish_or_trade():
    creator = make_user(email_verified=False)
    card_set = make_set(creator)
    fill_publishable(card_set, n_common=4, extra=("rare",))
    client = client_for(creator)

    preview = client.get(reverse("cards:publish", args=[card_set.id]))
    assert preview.status_code == 200
    response = client.post(reverse("cards:publish", args=[card_set.id]))
    assert response.status_code == 403
    assert response.json()["code"] == "email_unverified"

    other = make_user()
    offer = client.post(
        reverse("trades:offers"),
        {"recipient": other.username, "give": [], "want": []},
        format="json",
    )
    assert offer.status_code == 403
    assert client.get(reverse("trades:offers")).status_code == 200
