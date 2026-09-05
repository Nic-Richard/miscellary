import pytest
from django.urls import reverse

from cards.publishing import publish_set
from cards.removal import remove_set
from cards.tests.helpers import fill_publishable, make_set
from conftest import make_user
from packs.models import OwnedCard
from social.models import Follow, Reaction, Report, ShowcaseSlot
from trades import actions as trades
from trades.models import TradeOffer

pytestmark = pytest.mark.django_db


@pytest.fixture
def published(user):
    card_set = make_set(user, title="Garden Beetles", description="Every beetle in the garden.")
    fill_publishable(card_set, n_common=4, extra=("rare",))
    publish_set(card_set)
    card_set.refresh_from_db()
    return card_set


def test_profile_page(api_client, user, published):
    fan = make_user(username="fan")
    Follow.objects.create(follower=fan, following=user)
    owned = OwnedCard.objects.create(owner=user, card=published.cards.first())
    ShowcaseSlot.objects.create(user=user, position=0, owned_card=owned)

    response = api_client.get(reverse("social:profile", args=[user.username.upper()]))
    assert response.status_code == 200
    body = response.json()
    assert body["follower_count"] == 1 and body["following_count"] == 0
    assert body["set_count"] == 1 and body["card_count"] == 1
    assert body["sets"][0]["slug"] == published.slug
    assert body["showcase"][0]["owned_card"]["id"] == str(owned.id)
    assert body["is_following"] is False and body["is_me"] is False

    api_client.force_authenticate(fan)
    body = api_client.get(reverse("social:profile", args=[user.username])).json()
    assert body["is_following"] is True


def test_follow_and_unfollow(auth_client, user):
    make_user(username="other")
    url = reverse("social:follow", args=["other"])
    assert auth_client.post(url).json() == {"following": True, "follower_count": 1}
    assert auth_client.post(url).json()["follower_count"] == 1  # idempotent
    assert auth_client.post(reverse("social:follow", args=[user.username])).status_code == 400
    names = [
        u["username"]
        for u in auth_client.get(reverse("social:follow-list", args=["other", "followers"])).json()
    ]
    assert names == [user.username]
    assert auth_client.delete(url).json() == {"following": False, "follower_count": 0}


def test_showcase_only_shows_cards_you_still_own(auth_client, user, published):
    cards = list(published.cards.all())
    mine = OwnedCard.objects.create(owner=user, card=cards[0])
    also_mine = OwnedCard.objects.create(owner=user, card=cards[1])
    theirs = OwnedCard.objects.create(owner=make_user(username="bob"), card=cards[2])

    url = reverse("social:showcase")
    bad = auth_client.put(
        url, {"slots": [{"position": "0", "owned_card_id": str(theirs.id)}]}, format="json"
    )
    assert bad.status_code == 400

    response = auth_client.put(
        url,
        {
            "slots": [
                {"position": "0", "owned_card_id": str(mine.id)},
                {"position": "3", "owned_card_id": str(also_mine.id)},
            ]
        },
        format="json",
    )
    assert response.status_code == 200
    assert [s["position"] for s in response.json()] == [0, 3]

    # Trade one away: it silently drops out of the showcase.
    offer = trades.create_offer(user, theirs.owner, [mine.id], [theirs.id])
    trades.accept_offer(theirs.owner, offer)
    assert [s["position"] for s in auth_client.get(url).json()] == [3]


def test_likes_on_sets_and_cards(auth_client, user, published):
    set_url = reverse("social:like-set", args=[published.slug])
    assert auth_client.post(set_url).json() == {"liked": True, "like_count": 1}
    assert auth_client.post(set_url).json()["like_count"] == 1
    binder = auth_client.get(reverse("cards:public-set", args=[published.slug])).json()
    assert binder["like_count"] == 1 and binder["liked"] is True

    card = published.cards.first()
    card_url = reverse("social:like-card", args=[card.id])
    assert auth_client.post(card_url).json() == {"liked": True, "like_count": 1}
    binder = auth_client.get(reverse("cards:public-set", args=[published.slug])).json()
    assert binder["liked_card_ids"] == [str(card.id)]
    assert binder["cards"][0]["like_count"] == 1

    assert auth_client.delete(set_url).json() == {"liked": False, "like_count": 0}
    assert Reaction.objects.count() == 1


def test_popular_sort(api_client, user, published):
    quiet = make_set(user, title="Quiet")
    fill_publishable(quiet)
    publish_set(quiet)
    for _ in range(3):
        Reaction.objects.create(user=make_user(), card_set=published)
    titles = [
        s["title"]
        for s in api_client.get(reverse("cards:public-sets"), {"sort": "popular"}).json()["results"]
    ]
    assert titles == ["Garden Beetles", "Quiet"]
    newest = [s["title"] for s in api_client.get(reverse("cards:public-sets")).json()["results"]]
    assert newest == ["Quiet", "Garden Beetles"]


def test_reports(auth_client, user, published):
    url = reverse("social:report")
    response = auth_client.post(
        url,
        {"set_slug": published.slug, "reason": "stolen", "details": "That's my photo."},
        format="json",
    )
    assert response.status_code == 201
    assert Report.objects.get().card_set == published

    response = auth_client.post(url, {"username": user.username, "reason": "spam"}, format="json")
    assert response.status_code == 201
    response = auth_client.post(url, {"reason": "spam"}, format="json")
    assert response.status_code == 400
    response = auth_client.post(
        url, {"set_slug": published.slug, "username": "x", "reason": "spam"}, format="json"
    )
    assert response.status_code == 400


def test_search(api_client, user, published):
    draft = make_set(user, title="Garden Gnomes")  # never published, must not appear
    make_user(username="gardener")
    response = api_client.get(reverse("social:search"), {"q": "garden"})
    body = response.json()
    assert [s["slug"] for s in body["sets"]] == [published.slug]
    assert body["users"][0]["username"] == "gardener"
    assert draft.slug not in [s["slug"] for s in body["sets"]]

    body = api_client.get(reverse("social:search"), {"q": "beetles in the garden"}).json()
    assert body["sets"][0]["slug"] == published.slug

    body = api_client.get(reverse("social:search"), {"q": "Card 1"}).json()
    assert body["cards"] and body["cards"][0]["set_slug"] == published.slug

    assert api_client.get(reverse("social:search"), {"q": "x"}).json()["sets"] == []


def test_platform_removal_wipes_copies_and_cancels_trades(user, published):
    alice, bob = make_user(username="alice"), make_user(username="bob")
    cards = list(published.cards.all())
    a = OwnedCard.objects.create(owner=alice, card=cards[0])
    b = OwnedCard.objects.create(owner=bob, card=cards[1])
    offer = trades.create_offer(alice, bob, [a.id], [b.id])

    wiped = remove_set(published)

    assert wiped == 2
    assert OwnedCard.objects.count() == 0
    published.refresh_from_db()
    assert published.status == "removed"
    assert TradeOffer.objects.get(pk=offer.pk).status == "cancelled"


def test_creator_delete_keeps_copies(user, published):
    alice = make_user(username="alice")
    OwnedCard.objects.create(owner=alice, card=published.cards.first())
    published.soft_delete()
    assert OwnedCard.objects.filter(owner=alice).count() == 1
