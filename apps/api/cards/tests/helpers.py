from cards.models import CardDefinition, CardSet
from cards.templates import default_config
from uploads.models import Image


def make_image(owner, kind="card", ready=True) -> Image:
    return Image.objects.create(
        owner=owner,
        kind=kind,
        key=f"{kind}/{owner.username}-{Image.objects.count()}.jpg",
        content_type="image/jpeg",
        size=1000,
        width=800,
        height=1000,
        ready=ready,
    )


def make_set(creator, **overrides) -> CardSet:
    fields = {"title": "Rocks of the Backyard"}
    fields.update(overrides)
    return CardSet.objects.create(creator=creator, **fields)


def make_card(card_set, rarity="common", **overrides) -> CardDefinition:
    fields = {
        "image": make_image(card_set.creator),
        "title": f"Card {card_set.cards.count() + 1}",
        "rarity": rarity,
        "description": "",
        "template_key": "classic",
        "template_version": 1,
        "template_config": default_config("classic"),
        "position": card_set.cards.count(),
    }
    fields.update(overrides)
    return CardDefinition.objects.create(card_set=card_set, **fields)


def fill_publishable(card_set, n_common=4, extra=("rare",)):
    for _ in range(n_common):
        make_card(card_set, "common")
    for rarity in extra:
        make_card(card_set, rarity)
