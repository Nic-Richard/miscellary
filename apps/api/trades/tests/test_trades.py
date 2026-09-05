import threading

import pytest
from django.db import connection
from django.urls import reverse

from cards.publishing import publish_set
from cards.tests.helpers import fill_publishable, make_set
from conftest import make_user
from packs import actions as packs
from packs.models import OwnedCard
from trades import actions
from trades.models import TradeOffer

pytestmark = pytest.mark.django_db


def setup_two_collectors():
    creator = make_user()
    card_set = make_set(creator)
    fill_publishable(card_set, n_common=4, extra=("rare",))
    publish_set(card_set)
    cards = list(card_set.cards.all())
    alice, bob = make_user(username="alice"), make_user(username="bob")
    a1 = OwnedCard.objects.create(owner=alice, card=cards[0])
    a2 = OwnedCard.objects.create(owner=alice, card=cards[1])
    b1 = OwnedCard.objects.create(owner=bob, card=cards[4])
    return alice, bob, a1, a2, b1


def test_full_offer_lifecycle():
    alice, bob, a1, a2, b1 = setup_two_collectors()

    offer = actions.create_offer(alice, bob, [a1.id], [b1.id], "swap?")
    assert offer.is_pending
    assert actions.held_card_ids([a1.id, a2.id, b1.id]) == {a1.id, b1.id}

    # Held cards can't be offered again or recycled.
    with pytest.raises(actions.TradeError, match="pending trade"):
        actions.create_offer(alice, bob, [a1.id], [])
    OwnedCard.objects.create(owner=alice, card=a1.card)
    with pytest.raises(packs.PackError, match="pending trade"):
        packs.recycle_card(alice, a1)

    # Wrong person, wrong action.
    with pytest.raises(actions.TradeError):
        actions.accept_offer(alice, offer)
    with pytest.raises(actions.TradeError):
        actions.cancel_offer(bob, offer)

    actions.accept_offer(bob, offer)
    a1.refresh_from_db()
    b1.refresh_from_db()
    assert a1.owner == bob and b1.owner == alice
    assert TradeOffer.objects.get(pk=offer.pk).status == "accepted"
    with pytest.raises(actions.TradeError, match="no longer open"):
        actions.accept_offer(bob, offer)


def test_reject_cancel_and_counter():
    alice, bob, a1, a2, b1 = setup_two_collectors()

    rejected = actions.create_offer(alice, bob, [a1.id], [b1.id])
    actions.reject_offer(bob, rejected)
    assert TradeOffer.objects.get(pk=rejected.pk).status == "rejected"
    assert actions.held_card_ids([a1.id]) == set()

    cancelled = actions.create_offer(alice, bob, [a1.id], [b1.id])
    actions.cancel_offer(alice, cancelled)
    assert TradeOffer.objects.get(pk=cancelled.pk).status == "cancelled"

    original = actions.create_offer(alice, bob, [a1.id], [b1.id])
    counter = actions.counter_offer(bob, original, [b1.id], [a1.id, a2.id], "both please")
    assert TradeOffer.objects.get(pk=original.pk).status == "countered"
    assert counter.sender == bob and counter.recipient == alice
    assert counter.counter_of == original
    actions.accept_offer(alice, counter)
    assert OwnedCard.objects.filter(owner=bob).count() == 2
    assert OwnedCard.objects.filter(owner=alice).count() == 1


def test_failed_counter_leaves_original_pending_and_unchanged():
    alice, bob, a1, a2, b1 = setup_two_collectors()
    original = actions.create_offer(alice, bob, [a1.id], [b1.id], "original")
    item_ids = set(original.items.values_list("owned_card_id", flat=True))

    with pytest.raises(actions.TradeError, match="aren't available"):
        actions.counter_offer(bob, original, [a1.id], [b1.id], "invalid counter")

    original.refresh_from_db()
    assert original.status == TradeOffer.Status.PENDING
    assert original.resolved_at is None
    assert original.message == "original"
    assert set(original.items.values_list("owned_card_id", flat=True)) == item_ids
    assert TradeOffer.objects.count() == 1


def test_validation():
    alice, bob, a1, a2, b1 = setup_two_collectors()
    with pytest.raises(actions.TradeError, match="yourself"):
        actions.create_offer(alice, alice, [a1.id], [])
    with pytest.raises(actions.TradeError, match="at least one"):
        actions.create_offer(alice, bob, [], [])
    with pytest.raises(actions.TradeError, match="aren't available"):
        actions.create_offer(alice, bob, [b1.id], [])  # not alice's card
    with pytest.raises(actions.TradeError, match="both sides"):
        actions.create_offer(alice, bob, [a1.id], [a1.id])


def test_offer_cancels_itself_if_a_card_moved():
    alice, bob, a1, a2, b1 = setup_two_collectors()
    offer = actions.create_offer(alice, bob, [a1.id], [b1.id])
    # Something outside the trade system moves the card (e.g. an admin action).
    OwnedCard.objects.filter(pk=a1.pk).update(owner=make_user())
    with pytest.raises(actions.TradeError, match="changed hands"):
        actions.accept_offer(bob, offer)
    assert TradeOffer.objects.get(pk=offer.pk).status == "cancelled"
    b1.refresh_from_db()
    assert b1.owner == bob


def _race(fn, n=2):
    results = [None] * n
    barrier = threading.Barrier(n)

    def run(i):
        try:
            barrier.wait()
            fn()
        except Exception as exc:  # noqa: BLE001
            results[i] = exc
        finally:
            connection.close()

    threads = [threading.Thread(target=run, args=(i,)) for i in range(n)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    return results


@pytest.mark.django_db(transaction=True)
def test_concurrent_offers_cannot_hold_the_same_card():
    alice, bob, a1, a2, b1 = setup_two_collectors()
    carol = make_user(username="carol")
    c1 = OwnedCard.objects.create(owner=carol, card=a2.card)

    # Alice and Carol both try to grab Bob's card at the same instant.
    results = _race_each(
        [
            lambda: actions.create_offer(alice, bob, [a1.id], [b1.id]),
            lambda: actions.create_offer(carol, bob, [c1.id], [b1.id]),
        ]
    )

    assert sum(isinstance(r, actions.TradeError) for r in results) == 1
    assert TradeOffer.objects.filter(status="pending", items__owned_card=b1).count() == 1


def _race_each(fns):
    results = [None] * len(fns)
    barrier = threading.Barrier(len(fns))

    def run(i, fn):
        try:
            barrier.wait()
            fn()
        except Exception as exc:  # noqa: BLE001
            results[i] = exc
        finally:
            connection.close()

    threads = [threading.Thread(target=run, args=(i, fn)) for i, fn in enumerate(fns)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    return results


@pytest.mark.django_db(transaction=True)
def test_mirror_image_offers_do_not_deadlock():
    alice, bob, a1, a2, b1 = setup_two_collectors()
    results = _race_each(
        [
            lambda: actions.create_offer(alice, bob, [a1.id], [b1.id]),
            lambda: actions.create_offer(bob, alice, [b1.id], [a1.id]),
        ]
    )
    assert sum(r is None for r in results) == 1
    assert sum(isinstance(r, actions.TradeError) for r in results) == 1


@pytest.mark.django_db(transaction=True)
def test_concurrent_accepts_execute_once():
    alice, bob, a1, a2, b1 = setup_two_collectors()
    offer = actions.create_offer(alice, bob, [a1.id], [b1.id])

    results = _race(lambda: actions.accept_offer(bob, offer))

    assert sum(isinstance(r, actions.TradeError) for r in results) == 1
    assert OwnedCard.objects.get(pk=a1.pk).owner == bob
    assert OwnedCard.objects.get(pk=b1.pk).owner == alice


@pytest.mark.django_db(transaction=True)
def test_accept_and_cancel_race_resolves_one_way():
    alice, bob, a1, a2, b1 = setup_two_collectors()
    offer = actions.create_offer(alice, bob, [a1.id], [b1.id])

    outcomes = []

    def accept():
        actions.accept_offer(bob, offer)
        outcomes.append("accepted")

    def cancel():
        actions.cancel_offer(alice, offer)
        outcomes.append("cancelled")

    results = [None, None]
    barrier = threading.Barrier(2)

    def run(i, fn):
        try:
            barrier.wait()
            fn()
        except actions.TradeError as exc:
            results[i] = exc
        finally:
            connection.close()

    threads = [
        threading.Thread(target=run, args=(0, accept)),
        threading.Thread(target=run, args=(1, cancel)),
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(outcomes) == 1
    final = TradeOffer.objects.get(pk=offer.pk).status
    assert final == outcomes[0]
    moved = OwnedCard.objects.get(pk=a1.pk).owner == bob
    assert moved == (final == "accepted")


# ---- API ----


def test_api_flow(api_client):
    alice, bob, a1, a2, b1 = setup_two_collectors()

    # Bob's collection is public so Alice can pick what she wants.
    response = api_client.get(reverse("packs:user-collection", args=["bob"]))
    assert response.status_code == 200
    assert response.json()["results"][0]["id"] == str(b1.id)
    assert response.json()["results"][0]["held"] is False

    api_client.force_authenticate(alice)
    response = api_client.post(
        reverse("trades:offers"),
        {"recipient": "Bob", "give": [str(a1.id)], "want": [str(b1.id)], "message": "hi"},
        format="json",
    )
    assert response.status_code == 201
    offer = response.json()
    assert offer["status"] == "pending"
    assert [c["id"] for c in offer["give"]] == [str(a1.id)]
    assert [c["id"] for c in offer["want"]] == [str(b1.id)]

    assert (
        api_client.get(reverse("trades:offers"), {"box": "outbox"}).json()[0]["id"] == offer["id"]
    )
    assert api_client.get(reverse("packs:collection")).json()["results"][1]["held"] is True

    # Alice can't accept her own offer; Bob can.
    assert api_client.post(reverse("trades:accept", args=[offer["id"]])).status_code == 400
    api_client.force_authenticate(bob)
    assert api_client.get(reverse("trades:offers")).json()[0]["id"] == offer["id"]
    response = api_client.post(reverse("trades:accept", args=[offer["id"]]))
    assert response.status_code == 200
    assert response.json()["status"] == "accepted"
    assert (
        api_client.get(reverse("trades:offers"), {"box": "history"}).json()[0]["status"]
        == "accepted"
    )

    # Strangers can't see the offer at all.
    api_client.force_authenticate(make_user())
    assert api_client.get(reverse("trades:offer", args=[offer["id"]])).status_code == 404


def test_api_counter(api_client):
    alice, bob, a1, a2, b1 = setup_two_collectors()
    api_client.force_authenticate(alice)
    offer = api_client.post(
        reverse("trades:offers"),
        {"recipient": "bob", "give": [str(a1.id)], "want": [str(b1.id)]},
        format="json",
    ).json()
    api_client.force_authenticate(bob)
    response = api_client.post(
        reverse("trades:counter", args=[offer["id"]]),
        {"give": [str(b1.id)], "want": [str(a1.id), str(a2.id)]},
        format="json",
    )
    assert response.status_code == 201
    assert response.json()["counter_of"] == offer["id"]
    assert response.json()["sender"]["username"] == "bob"
    assert (
        api_client.get(reverse("trades:offer", args=[offer["id"]])).json()["status"] == "countered"
    )
