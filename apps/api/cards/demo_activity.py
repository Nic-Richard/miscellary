from datetime import timedelta

from django.core.management.base import CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import User
from cards.catalogue import load_manifest, stable_id
from cards.identity import BINDER_COLOURS
from cards.models import CardSet
from packs.models import OwnedCard, PackOpening, SetPoints
from social.models import Comment, Follow, Notification, Reaction, SetFollow, ShowcaseSlot
from trades.models import TradeOffer, TradeOfferItem

COMMENTS = (
    ("garden-birds", "ellisgrant", "The blue tit was the last one I pulled."),
    ("film-cameras", "orla", "That SX-70 card came out nicely."),
    ("pocket-geology", "marabell", "Still looking for the amethyst."),
)


def _catalogue_rows():
    manifest = load_manifest()
    users = {
        definition["username"]: User.objects.filter(
            pk=stable_id("creator", definition["username"]), is_demo=True
        ).first()
        for definition in manifest["creators"]
    }
    sets = {}
    for definition in manifest["sets"]:
        card_set = (
            CardSet.objects.prefetch_related("cards")
            .filter(pk=stable_id("set", definition["title"]))
            .first()
        )
        if card_set:
            sets[card_set.slug] = card_set
    if any(user is None for user in users.values()) or len(sets) != len(manifest["sets"]):
        raise CommandError("Run bootstrap_catalogue before refreshing demo activity.")
    return list(users.values()), sets


def _clear(users, sets) -> None:
    user_ids = [user.id for user in users]
    set_ids = [card_set.id for card_set in sets.values()]
    TradeOffer.objects.filter(sender_id__in=user_ids, recipient_id__in=user_ids).delete()
    protected_cards = TradeOfferItem.objects.filter(owned_card__owner_id__in=user_ids).values_list(
        "owned_card_id", flat=True
    )
    ShowcaseSlot.objects.filter(user_id__in=user_ids).delete()
    OwnedCard.objects.filter(owner_id__in=user_ids).exclude(pk__in=protected_cards).delete()
    PackOpening.objects.filter(user_id__in=user_ids).delete()
    SetPoints.objects.filter(user_id__in=user_ids).delete()
    Reaction.objects.filter(user_id__in=user_ids, card_set_id__in=set_ids).delete()
    Reaction.objects.filter(user_id__in=user_ids, card__card_set_id__in=set_ids).delete()
    SetFollow.objects.filter(user_id__in=user_ids, card_set_id__in=set_ids).delete()
    Follow.objects.filter(follower_id__in=user_ids, following_id__in=user_ids).delete()
    Notification.objects.filter(recipient_id__in=user_ids, actor_id__in=user_ids).delete()


def _collections(users, sets) -> None:
    ordered_sets = sorted(sets.values(), key=lambda card_set: card_set.slug)
    today = timezone.now().date()
    for user_index, user in enumerate(users):
        available = [card_set for card_set in ordered_sets if card_set.creator_id != user.id]
        for set_index, card_set in enumerate(available[: 2 + user_index % 3]):
            opening = PackOpening.objects.create(
                id=stable_id("demo-opening", user.username, card_set.slug),
                user=user,
                card_set=card_set,
                kind=PackOpening.Kind.FREE,
                opened_on=today - timedelta(days=set_index + 1),
            )
            cards = list(card_set.cards.all())
            for copy_index in range(min(card_set.pack_size, 6)):
                card = cards[(user_index * 3 + copy_index * 2) % len(cards)]
                OwnedCard.objects.update_or_create(
                    id=stable_id("demo-owned", user.username, card_set.slug, copy_index),
                    defaults={"owner": user, "card": card, "pack_opening": opening},
                )
        owned = list(user.owned_cards.order_by("acquired_at")[:8])
        ShowcaseSlot.objects.bulk_create(
            [
                ShowcaseSlot(user=user, position=position, owned_card=owned_card)
                for position, owned_card in enumerate(owned)
            ]
        )
        profile = user.profile
        profile.binder_colour = BINDER_COLOURS[user_index % len(BINDER_COLOURS)]
        profile.save(update_fields=["binder_colour", "updated_at"])


def _social(users, sets) -> None:
    ordered_sets = sorted(sets.values(), key=lambda card_set: card_set.slug)
    reactions = []
    follows = []
    set_follows = []
    for user_index, user in enumerate(users):
        for set_index, card_set in enumerate(ordered_sets):
            if card_set.creator_id == user.id:
                continue
            if (user_index + set_index) % 3 != 0:
                reactions.append(Reaction(user=user, card_set=card_set))
            if (user_index + set_index) % 2 == 0:
                set_follows.append(SetFollow(user=user, card_set=card_set))
            cards = list(card_set.cards.all())
            if (user_index + set_index) % 4 == 0:
                reactions.append(
                    Reaction(user=user, card=cards[(user_index + set_index) % len(cards)])
                )
        for other_index, other in enumerate(users):
            if user.id != other.id and (user_index * 2 + other_index) % 4 == 0:
                follows.append(Follow(follower=user, following=other))
    Reaction.objects.bulk_create(reactions)
    Follow.objects.bulk_create(follows)
    SetFollow.objects.bulk_create(set_follows)

    users_by_name = {user.username: user for user in users}
    for slug, username, body in COMMENTS:
        card_set = sets[slug]
        identity = stable_id("demo-comment", slug, username)
        comment = Comment.objects.filter(pk=identity).first()
        expected = {"card_set": card_set, "author": users_by_name[username], "body": body}
        if comment:
            if comment.replies.exclude(author__is_demo=True).exists():
                continue
            for field, value in expected.items():
                setattr(comment, field, value)
            comment.deleted_at = None
            comment.save(update_fields=["card_set", "author", "body", "deleted_at"])
        else:
            Comment.objects.create(id=identity, **expected)


def _trades(users) -> None:
    by_name = {user.username: user for user in users}
    pairs = (("devonlee", "ellisgrant"), ("orla", "ellisgrant"))
    for index, (sender_name, recipient_name) in enumerate(pairs):
        sender = by_name[sender_name]
        recipient = by_name[recipient_name]
        give = sender.owned_cards.filter(trade_items__isnull=True).first()
        want = recipient.owned_cards.filter(trade_items__isnull=True).first()
        if not give or not want:
            continue
        offer = TradeOffer.objects.create(
            id=stable_id("demo-trade", index),
            sender=sender,
            recipient=recipient,
            message="Straight swap?" if index else "One for one?",
        )
        TradeOfferItem.objects.bulk_create(
            [
                TradeOfferItem(offer=offer, owned_card=give, side=TradeOfferItem.Side.GIVE),
                TradeOfferItem(offer=offer, owned_card=want, side=TradeOfferItem.Side.WANT),
            ]
        )


def refresh_demo_activity(include_trades: bool = False) -> None:
    users, sets = _catalogue_rows()
    with transaction.atomic():
        _clear(users, sets)
        _collections(users, sets)
        _social(users, sets)
        if include_trades:
            _trades(users)
