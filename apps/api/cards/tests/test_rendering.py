import json

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.urls import reverse

from cards.publishing import publish_set
from cards.rendering import CARD_RENDERER_VERSION, back_render_signature, card_render_signature
from cards.tests.helpers import fill_publishable, make_set

pytestmark = pytest.mark.django_db


def test_published_card_reports_pending_then_ready(api_client, user):
    card_set = make_set(user)
    fill_publishable(card_set)
    publish_set(card_set)
    card = card_set.cards.select_related("image", "card_set").first()

    pending = api_client.get(reverse("cards:public-set", args=[card_set.slug])).json()
    assert pending["render_back"]["status"] == "pending"
    assert pending["cards"][0]["render"]["status"] == "pending"

    card_set.render_back_signature = back_render_signature(card_set)
    card_set.render_back_key = "renders/back.webp"
    card_set.save(update_fields=["render_back_signature", "render_back_key"])
    card.render_signature = card_render_signature(card)
    card.render_front_thumbnail_key = "renders/thumb.webp"
    card.render_front_key = "renders/front.webp"
    card.save(update_fields=["render_signature", "render_front_thumbnail_key", "render_front_key"])

    ready = api_client.get(reverse("cards:public-set", args=[card_set.slug])).json()
    assert ready["render_back"]["status"] == "ready"
    assert ready["cards"][0]["render"]["status"] == "ready"
    assert ready["cards"][0]["render"]["thumbnail"]["width"] == 300
    assert ready["cards"][0]["render"]["front"]["width"] == 1000


def test_import_card_renders_uploads_current_manifest(tmp_path, monkeypatch, user):
    card_set = make_set(user)
    fill_publishable(card_set)
    publish_set(card_set)
    card = card_set.cards.select_related("image", "card_set").first()
    for name in ("back.webp", "front.webp", "thumbnail.webp"):
        (tmp_path / name).write_bytes(name.encode())
    manifest = {
        "renderer_version": CARD_RENDERER_VERSION,
        "sets": [
            {
                "id": str(card_set.id),
                "signature": back_render_signature(card_set),
                "back": "back.webp",
            }
        ],
        "cards": [
            {
                "id": str(card.id),
                "signature": card_render_signature(card),
                "front": "front.webp",
                "thumbnail": "thumbnail.webp",
                "mask": None,
                "mask_thumbnail": None,
            }
        ],
    }
    path = tmp_path / "manifest.json"
    path.write_text(json.dumps(manifest), encoding="utf-8")
    uploaded = []
    monkeypatch.setattr(
        "cards.management.commands.import_card_renders.storage.put_object",
        lambda key, body, content_type: uploaded.append((key, body, content_type)),
    )

    call_command("import_card_renders", path)

    card_set.refresh_from_db()
    card.refresh_from_db()
    assert card_set.render_back_key.endswith("/back.webp")
    assert card.render_front_thumbnail_key.endswith("/front-300.webp")
    assert len(uploaded) == 3


def test_import_card_renders_validates_manifest_before_uploading(tmp_path, monkeypatch, user):
    card_set = make_set(user)
    fill_publishable(card_set)
    publish_set(card_set)
    (tmp_path / "back.webp").write_bytes(b"back")
    manifest = {
        "renderer_version": CARD_RENDERER_VERSION,
        "sets": [
            {
                "id": str(card_set.id),
                "signature": back_render_signature(card_set),
                "back": "back.webp",
            }
        ],
        "cards": [
            {
                "id": "00000000-0000-0000-0000-000000000000",
                "signature": "invalid",
                "front": "missing.webp",
                "thumbnail": "missing.webp",
                "mask": None,
                "mask_thumbnail": None,
            }
        ],
    }
    path = tmp_path / "manifest.json"
    path.write_text(json.dumps(manifest), encoding="utf-8")
    uploaded = []
    monkeypatch.setattr(
        "cards.management.commands.import_card_renders.storage.put_object",
        lambda *args: uploaded.append(args),
    )

    with pytest.raises(CommandError):
        call_command("import_card_renders", path)

    card_set.refresh_from_db()
    assert card_set.render_back_key == ""
    assert uploaded == []
