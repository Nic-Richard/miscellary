import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from cards.models import CardDefinition, CardSet
from cards.rendering import CARD_RENDERER_VERSION, back_render_signature, card_render_signature
from uploads import storage


class Command(BaseCommand):
    help = "Upload locally baked card renders and attach them to published definitions."

    def add_arguments(self, parser):
        parser.add_argument("manifest")

    def handle(self, *args, **options):
        manifest_path = Path(options["manifest"]).resolve()
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise CommandError(f"Could not read render manifest: {error}") from error
        if not isinstance(manifest, dict):
            raise CommandError("The render manifest must be a JSON object.")
        if manifest.get("renderer_version") != CARD_RENDERER_VERSION:
            raise CommandError("The manifest renderer version does not match the API.")
        sets = manifest.get("sets", [])
        cards = manifest.get("cards", [])
        if not isinstance(sets, list) or not all(isinstance(item, dict) for item in sets):
            raise CommandError("The manifest sets value must be a list of objects.")
        if not isinstance(cards, list) or not all(isinstance(item, dict) for item in cards):
            raise CommandError("The manifest cards value must be a list of objects.")

        root = manifest_path.parent
        set_imports = []
        card_imports = []

        for item in sets:
            card_set = CardSet.objects.filter(
                pk=item.get("id"), status=CardSet.Status.PUBLISHED
            ).first()
            if card_set is None or item.get("signature") != back_render_signature(card_set):
                raise CommandError(f"Set render input changed: {item.get('id', 'unknown')}")
            key = f"renders/sets/{card_set.id}/{item['signature']}/back.webp"
            set_imports.append(
                (card_set, item["signature"], key, self._path(root, item.get("back")))
            )

        for item in cards:
            card = (
                CardDefinition.objects.select_related("image", "card_set")
                .filter(pk=item.get("id"), card_set__status=CardSet.Status.PUBLISHED)
                .first()
            )
            if card is None or item.get("signature") != card_render_signature(card):
                raise CommandError(f"Card render input changed: {item.get('id', 'unknown')}")
            chase = card.template_config.get("treatment") in {"foil", "holo"}
            if chase != bool(item.get("mask") and item.get("mask_thumbnail")):
                raise CommandError(f"Card material mask is incomplete: {card.id}")

            prefix = f"renders/cards/{card.id}/{item['signature']}"
            files = {
                "render_front_thumbnail_key": (
                    f"{prefix}/front-300.webp",
                    "image/webp",
                    self._path(root, item.get("thumbnail")),
                ),
                "render_front_key": (
                    f"{prefix}/front-1000.webp",
                    "image/webp",
                    self._path(root, item.get("front")),
                ),
            }
            if chase:
                files.update(
                    {
                        "render_mask_thumbnail_key": (
                            f"{prefix}/mask-300.png",
                            "image/png",
                            self._path(root, item.get("mask_thumbnail")),
                        ),
                        "render_mask_key": (
                            f"{prefix}/mask-1000.png",
                            "image/png",
                            self._path(root, item.get("mask")),
                        ),
                    }
                )
            card_imports.append((card, item["signature"], files))

        for _, _, key, path in set_imports:
            storage.put_object(key, path.read_bytes(), "image/webp")
        for _, _, files in card_imports:
            for key, content_type, path in files.values():
                storage.put_object(key, path.read_bytes(), content_type)

        with transaction.atomic():
            for card_set, signature, key, _ in set_imports:
                card_set.render_back_signature = signature
                card_set.render_back_key = key
                card_set.save(update_fields=["render_back_signature", "render_back_key"])

            for card, signature, files in card_imports:
                values = {
                    "render_signature": signature,
                    "render_mask_key": "",
                    "render_mask_thumbnail_key": "",
                }
                values.update({field: key for field, (key, _, _) in files.items()})
                CardDefinition.objects.filter(pk=card.pk).update(**values)

        self.stdout.write(
            self.style.SUCCESS(
                f"Imported {len(card_imports)} card render(s) and {len(set_imports)} card back(s)."
            )
        )

    def _path(self, root: Path, relative: object) -> Path:
        if not isinstance(relative, str) or not relative:
            raise CommandError("The render manifest contains a missing file path.")
        path = (root / relative).resolve()
        if not path.is_relative_to(root) or not path.is_file():
            raise CommandError(f"Missing render file: {relative}")
        return path
