import hashlib
import json

from django.conf import settings

from .models import CardDefinition, CardSet

CARD_RENDERER_VERSION = 1
THUMBNAIL_SIZE = (300, 420)
FACE_SIZE = (1000, 1400)


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
            "image": card.image.key,
            "template_key": card.template_key,
            "template_version": card.template_version,
            "template_config": card.template_config,
            "position": card.position,
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
