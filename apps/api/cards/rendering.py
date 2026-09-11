import hashlib
import json

from django.conf import settings

from .models import CardDefinition, CardSet

CARD_RENDERER_VERSION = 1
THUMBNAIL_SIZE = (300, 420)
FACE_SIZE = (1000, 1400)


SPOT_TIERS = {"uncommon", "rare", "epic", "legendary"}
SPOT_AREAS = {"spot", "reverse", "full"}


def card_spot(config: dict, rarity: str) -> dict[str, str] | None:
    """Return the spot material and coverage used by the renderer."""
    if rarity not in SPOT_TIERS:
        return None
    treatment = config.get("treatment")
    if treatment in {"foil", "holo"}:
        coverage = config.get("coverage")
        return {"material": treatment, "area": coverage if coverage in SPOT_AREAS else "spot"}
    coverage = config.get("coverage")
    area = coverage if coverage in SPOT_AREAS else "spot"
    if config.get("finish") == "metallic":
        return {"material": "foil", "area": area}
    if config.get("finish") == "pearl":
        return {"material": "pearl", "area": area}
    return {"material": "varnish", "area": area}


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
