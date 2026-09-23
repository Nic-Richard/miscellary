import random
import zlib
from collections.abc import Sequence
from datetime import timedelta

from django.core.management.base import CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import User
from cards.catalogue import load_manifest, stable_id
from cards.identity import BINDER_COLOURS
from cards.models import CardSet
from cards.rarity import RARITIES
from packs.actions import _pull_cards
from packs.models import OwnedCard, PackOpening, SetPoints
from social.models import Comment, Follow, Notification, Reaction, SetFollow, ShowcaseSlot
from trades.models import TradeOffer, TradeOfferItem

# Every choice below comes from this seed, so a refresh rebuilds the same activity.
SEED = "miscellary-demo-activity"
SHOWCASE_SIZE = 8

# What each demo account calls its profile binder, and the cover it picked.
BINDERS = {
    "ellisgrant": ("", "moss"),
    "marabell": ("don't ask", "oxblood"),
    "devonlee": ("", "tan"),
    "orla": ("Orla's favourites", "sand"),
    "kit": ("3am pulls", "indigo"),
    "bex": ("", "rust"),
    "sol": ("trade bait", "slate"),
    "wren": ("", "forest"),
    "theopark": ("high scores", "charcoal"),
    "inesduarte": ("shiny ones", "plum"),
    "priyanair": ("", "ocean"),
    "martaquist": ("", "charcoal"),
    "tomasreyes": ("checkmate", "slate"),
    "jamiecole": ("quack", "teal"),
    "kasianowak": ("", "plum"),
    "devpatel": ("winners", "indigo"),
    "rosiehughes": ("", "moss"),
    "loumartinez": ("night drives", "oxblood"),
}

# (set slug, author, body, replies as (author, body))
COMMENTS = (
    ("garden-birds", "ellisgrant", "The blue tit was the last one I pulled.", ()),
    ("film-cameras", "orla", "That SX-70 card came out nicely.", ()),
    (
        "pocket-geology",
        "marabell",
        "Still looking for the amethyst.",
        (("ellisgrant", "It's in there, I promise."),),
    ),
    (
        "rubber-ducks-in-bulk",
        "kasianowak",
        "I need the top hat one so bad.",
        (("jamiecole", "He's only an uncommon but he acts like a legendary."),),
    ),
    (
        "rubber-ducks-in-bulk",
        "devpatel",
        "The Toronto duck is ridiculous and I need it.",
        (("sol", "Get in line."),),
    ),
    ("bulk-candy", "rosiehughes", "The melon rings card made me go out and buy melon rings.", ()),
    (
        "bulk-candy",
        "jamiecole",
        "Licorice allsorts are elite and I will not be taking questions.",
        (("bex", "The pink coconut ones only."),),
    ),
    (
        "the-midway",
        "loumartinez",
        "Starship 2000 is the best neon in the app and it isn't even in the neon set.",
        (("devpatel", "I'll allow it."),),
    ),
    ("the-midway", "orla", "Three packs in and still no swing ride.", ()),
    ("gnomes-and-flamingos", "wren", "Zombie gnome lives in my binder now.", ()),
    (
        "gnomes-and-flamingos",
        "kit",
        "The Class of 2020 card got me a little.",
        (("rosiehughes", "Same. That school did a really nice thing."),),
    ),
    ("open-late", "theopark", "Ugly Duckling Car Sales is the best sign ever made.", ()),
    ("open-late", "marabell", "Need the Top of the Pops one for my music binder.", ()),
    (
        "kings-queens-and-pawns",
        "devonlee",
        "The Lewis king looks like he's had a long day.",
        (("tomasreyes", "About eight hundred years of them."),),
    ),
    (
        "letters-by-machine",
        "inesduarte",
        "The Valentine card is so good. Still haven't pulled it.",
        (),
    ),
    (
        "letters-by-machine",
        "sol",
        "Anyone want to trade a blue Hermes for a Selectric?",
        (("martaquist", "Not the red one. Anything but the red one."),),
    ),
    ("a-bunch-of-keys", "bex", "The Mister Minit key is so specific and I love it.", ()),
    ("a-bunch-of-keys", "tomasreyes", "Had no idea chamberlains carried keys like that.", ()),
    ("pocket-watches-open-and-shut", "martaquist", "Still chasing the Lodewijk watch.", ()),
    ("pocket-watches-open-and-shut", "priyanair", "The engraved 1924 Waltham is lovely.", ()),
    (
        "consoles-1972-to-1999",
        "jamiecole",
        "Virtual Boy as the legendary is correct.",
        (("theopark", "It's the hardest one to find working, too."),),
    ),
    ("consoles-1972-to-1999", "kasianowak", "My first handheld was the purple Game Boy Color.", ()),
    ("fountain-pens-old-and-new", "loumartinez", "The Arco card is gorgeous.", ()),
    ("woodland-fungi", "rosiehughes", "This set is so calming to flip through.", ()),
    ("planets-and-moons", "devpatel", "Saving my points for this one.", ()),
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


def _popularity(names: list[str]) -> dict[str, float]:
    """A fixed, uneven ranking, so a few sets and people draw most of the attention."""
    ranked = sorted(names, key=lambda name: zlib.crc32(f"{SEED}:{name}".encode()))
    return {name: 1 / (rank + 1) ** 0.6 for rank, name in enumerate(ranked)}


def _weighted_sample(rng: random.Random, items: list, weights: Sequence[float], count: int) -> list:
    items, weights = list(items), list(weights)
    picked: list = []
    while items and len(picked) < count:
        index = rng.choices(range(len(items)), weights=weights)[0]
        picked.append(items.pop(index))
        weights.pop(index)
    return picked


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


def _collections(rng: random.Random, users, sets) -> dict:
    """Open packs for every demo account; returns the sets each one collects."""
    ordered = sorted(sets.values(), key=lambda card_set: card_set.slug)
    weight = _popularity([card_set.slug for card_set in ordered])
    collected: dict = {}
    for user in users:
        available = [card_set for card_set in ordered if card_set.creator_id != user.id]
        count = rng.randint(3, 7)
        collected[user] = _weighted_sample(
            rng, available, [weight[card_set.slug] for card_set in available], count
        )
    # Every set has at least one collector, taken on by whoever collects least.
    for card_set in ordered:
        if not any(card_set in picks for picks in collected.values()):
            candidates = [user for user in users if card_set.creator_id != user.id]
            fewest = min(candidates, key=lambda user: len(collected[user]))
            collected[fewest].append(card_set)

    today = timezone.now().date()
    for user_index, user in enumerate(users):
        for set_index, card_set in enumerate(collected[user]):
            # The first set someone picks is their favourite, and they open more of it.
            opens = rng.randint(2, 4) if set_index == 0 else 1
            for number, days_ago in enumerate(sorted(rng.sample(range(1, 60), opens))):
                opening = PackOpening.objects.create(
                    id=stable_id("demo-opening", user.username, card_set.slug, number),
                    user=user,
                    card_set=card_set,
                    kind=PackOpening.Kind.FREE,
                    opened_on=today - timedelta(days=days_ago),
                )
                OwnedCard.objects.bulk_create(
                    [
                        OwnedCard(
                            id=stable_id("demo-owned", user.username, card_set.slug, number, pull),
                            owner=user,
                            card=card,
                            pack_opening=opening,
                        )
                        for pull, card in enumerate(_pull_cards(card_set, rng))
                    ],
                    # A copy held in a real person's trade offer survived the clear.
                    ignore_conflicts=True,
                )
        owned = sorted(
            user.owned_cards.select_related("card"),
            key=lambda copy: (-RARITIES.index(copy.card.rarity), str(copy.id)),
        )
        showcased: list[OwnedCard] = []
        seen = set()
        for copy in owned:
            if copy.card_id not in seen and len(showcased) < SHOWCASE_SIZE:
                showcased.append(copy)
                seen.add(copy.card_id)
        ShowcaseSlot.objects.bulk_create(
            [
                ShowcaseSlot(user=user, position=position, owned_card=copy)
                for position, copy in enumerate(showcased)
            ]
        )
        profile = user.profile
        title, colour = BINDERS.get(
            user.username, ("", BINDER_COLOURS[user_index % len(BINDER_COLOURS)])
        )
        profile.showcase_title = title
        profile.binder_colour = colour
        profile.save(update_fields=["showcase_title", "binder_colour", "updated_at"])
    return collected


def _social(rng: random.Random, users, sets, collected) -> None:
    ordered = sorted(sets.values(), key=lambda card_set: card_set.slug)
    set_weight = _popularity([card_set.slug for card_set in ordered])
    person_weight = _popularity([user.username for user in users])
    reactions, set_follows, follows = [], [], []
    for user in users:
        mine = collected[user]
        for card_set in ordered:
            if card_set.creator_id == user.id:
                continue
            chance = 0.1 + 0.5 * set_weight[card_set.slug] + (0.3 if card_set in mine else 0)
            if rng.random() < chance:
                reactions.append(Reaction(user=user, card_set=card_set))
            follow_chance = 0.6 if card_set in mine else 0.15 * set_weight[card_set.slug]
            if rng.random() < follow_chance:
                set_follows.append(SetFollow(user=user, card_set=card_set))
        # Cards get liked in the sets people collect, the ones they own most of all.
        owned = set(user.owned_cards.values_list("card_id", flat=True))
        liked: set = set()
        for card_set in mine:
            cards = list(card_set.cards.all())
            weights = [
                (3 if card.id in owned else 1) * (1 + RARITIES.index(card.rarity)) for card in cards
            ]
            picks = _weighted_sample(rng, cards, weights, rng.randint(2, 5))
            liked.update(card.id for card in picks)
        for card_set in ordered:
            if card_set not in mine and rng.random() < 0.4 * set_weight[card_set.slug]:
                liked.add(rng.choice(list(card_set.cards.all())).id)
        reactions.extend(Reaction(user=user, card_id=card_id) for card_id in sorted(liked, key=str))

        others = [other for other in users if other.id != user.id]
        for other in _weighted_sample(
            rng, others, [person_weight[other.username] for other in others], rng.randint(2, 6)
        ):
            follows.append(Follow(follower=user, following=other))
    # Nobody is left without a follower.
    followed = {follow.following_id for follow in follows}
    for user in users:
        if user.id not in followed:
            follower = rng.choice([other for other in users if other.id != user.id])
            follows.append(Follow(follower=follower, following=user))
    Reaction.objects.bulk_create(reactions)
    Follow.objects.bulk_create(follows)
    SetFollow.objects.bulk_create(set_follows)
    _comments(rng, users, sets)


def _comments(rng: random.Random, users, sets) -> None:
    by_name = {user.username: user for user in users}
    now = timezone.now()
    expected = set()
    for slug, author, body, replies in COMMENTS:
        if slug not in sets or author not in by_name:
            continue
        identity = stable_id("demo-comment", slug, author)
        expected.add(identity)
        comment = _place_comment(identity, sets[slug], by_name[author], body, None)
        if comment is None:
            continue
        posted = now - timedelta(days=rng.randint(2, 40), hours=rng.randint(0, 23))
        Comment.objects.filter(pk=identity).update(created_at=posted)
        for index, (reply_author, reply_body) in enumerate(replies):
            if reply_author not in by_name:
                continue
            reply_id = stable_id("demo-reply", slug, author, index)
            expected.add(reply_id)
            if _place_comment(reply_id, sets[slug], by_name[reply_author], reply_body, comment):
                answered = posted + timedelta(hours=rng.randint(1, 48))
                Comment.objects.filter(pk=reply_id).update(created_at=answered)
    # Demo comments dropped from the list go, unless a real person has replied to them.
    Comment.objects.filter(
        author__in=users, card_set__in=sets.values(), parent__isnull=True
    ).exclude(pk__in=expected).exclude(replies__author__is_demo=False).delete()


def _place_comment(identity, card_set, author, body, parent):
    comment = Comment.objects.filter(pk=identity).first()
    expected = {"card_set": card_set, "author": author, "body": body, "parent": parent}
    if comment:
        if comment.replies.exclude(author__is_demo=True).exists():
            return None
        for field, value in expected.items():
            setattr(comment, field, value)
        comment.deleted_at = None
        comment.save(update_fields=["card_set", "author", "body", "parent", "deleted_at"])
        return comment
    return Comment.objects.create(id=identity, **expected)


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
    rng = random.Random(SEED)
    with transaction.atomic():
        _clear(users, sets)
        collected = _collections(rng, users, sets)
        _social(rng, users, sets, collected)
        if include_trades:
            _trades(users)
