import hashlib
import json

from django.conf import settings

from .models import CardDefinition, CardSet

# Raise after launch when renderer changes must invalidate stored renders.
CARD_RENDERER_VERSION = 1
THUMBNAIL_SIZE = (300, 420)
FACE_SIZE = (1000, 1400)


SPOT_TIERS = {"uncommon", "rare", "epic", "legendary"}
SPOT_AREAS = {"spot", "reverse", "full"}


def card_spot(config: dict, rarity: str) -> dict[str, str] | None:
    """The spot material a card is masked for, which is its chosen foil or nothing.

    Mirrors resolveCardSpot in packages/shared. A card without a foil needs no
    mask, so the two have to agree or the import rejects the bake.
    """
    if rarity not in SPOT_TIERS:
        return None
    treatment = config.get("treatment")
    if treatment not in {"foil", "holo"}:
        return None
    coverage = config.get("coverage")
    return {"material": treatment, "area": coverage if coverage in SPOT_AREAS else "spot"}


def _signature(value: dict) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


def card_render_signature(card: CardDefinition) -> str:
    return _signature(
        {
            "version": CARD_RENDERER_VERSION,
            "title": card.title,
            "rarity": card.rarity,
            "description": card.description,
            "printed_text": card.printed_text,
            "image": card.image.key,
            "template_key": card.template_key,
            "template_version": card.template_version,
            "template_config": card.template_config,
            "position": card.position,
            "set_code": card.card_set.printed_code,
            "set_total": card.set_total,
            "mark": card.card_set.mark,
        }
    )


PACK_SIZE_PX = (640, 800)


def pack_render_signature(card_set: CardSet) -> str:
    """Everything printed on the front of the wrapper.

    A list can be shown as a picture of the pack rather than a live drawing of
    it, which is what lets a phone show a screen of them.
    """
    return _signature(
        {
            "version": CARD_RENDERER_VERSION,
            "title": card_set.title,
            "mark": card_set.mark,
            "mark_scale": card_set.mark_scale,
            "pack_colour": card_set.pack_colour,
            "pack_finish": card_set.pack_finish,
            "pack_layers": card_set.pack_layers,
            "pack_text": card_set.pack_text,
            "pack_subtitle": card_set.pack_subtitle,
            "emblem_layout": card_set.emblem_layout,
            "emblem_shape": card_set.emblem_shape,
            "emblem_style": card_set.emblem_style,
            "emblem_text": card_set.emblem_text,
            "emblem_type_scale": card_set.emblem_type_scale,
        }
    )


def back_render_signature(card_set: CardSet) -> str:
    return _signature(
        {
            "version": CARD_RENDERER_VERSION,
            "title": card_set.title,
            "mark": card_set.mark,
            "pack_colour": card_set.pack_colour,
        }
    )


def render_url(key: str) -> str:
    return f"{settings.MEDIA_PUBLIC_URL.rstrip('/')}/{key}"
