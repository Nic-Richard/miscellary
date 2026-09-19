import json
from pathlib import Path, PurePosixPath
from urllib.parse import urlsplit

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from cards.models import CardDefinition, CardSet
from cards.rendering import (
    CARD_RENDERER_VERSION,
    back_render_signature,
    card_render_signature,
    card_spot,
    pack_render_signature,
)
from uploads import storage


class Command(BaseCommand):
    help = "Upload locally baked card renders and attach them to published definitions."

    def add_arguments(self, parser):
        parser.add_argument("manifest")

    def handle(self, *args, **options):
        try:
            manifest, source = self._manifest(options["manifest"])
        except (OSError, json.JSONDecodeError, UnicodeDecodeError) as error:
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

        set_imports = []
        card_imports = []

        for item in sets:
            card_set = CardSet.objects.filter(
                pk=item.get("id"), status=CardSet.Status.PUBLISHED
            ).first()
            if card_set is None or item.get("signature") != back_render_signature(card_set):
                raise CommandError(f"Set render input changed: {item.get('id', 'unknown')}")
            pack_signature = pack_render_signature(card_set)
            if item.get("pack_signature") != pack_signature:
                raise CommandError(f"Pack render input changed: {item.get('id', 'unknown')}")
            key = f"renders/sets/{card_set.id}/{item['signature']}/back.webp"
            pack_key = f"renders/sets/{card_set.id}/{pack_signature}/pack.webp"
            set_imports.append(
                (
                    card_set,
                    item["signature"],
                    key,
                    self._file(source, item.get("back")),
                    pack_signature,
                    pack_key,
                    self._file(source, item.get("pack")),
                )
            )

        for item in cards:
            card = (
                CardDefinition.objects.select_related("image", "card_set")
                .filter(pk=item.get("id"), card_set__status=CardSet.Status.PUBLISHED)
                .first()
            )
            if card is None or item.get("signature") != card_render_signature(card):
                raise CommandError(f"Card render input changed: {item.get('id', 'unknown')}")
            spot = bool(card_spot(card.template_config, card.rarity))
            if spot != bool(item.get("mask") and item.get("mask_thumbnail")):
                raise CommandError(f"Card material mask is incomplete: {card.id}")

            prefix = f"renders/cards/{card.id}/{item['signature']}"
            files = {
                "render_front_thumbnail_key": (
                    f"{prefix}/front-300.webp",
                    "image/webp",
                    self._file(source, item.get("thumbnail")),
                ),
                "render_front_key": (
                    f"{prefix}/front-1000.webp",
                    "image/webp",
                    self._file(source, item.get("front")),
                ),
                "render_flat_thumbnail_key": (
                    f"{prefix}/flat-300.webp",
                    "image/webp",
                    self._file(source, item.get("flat_thumbnail")),
                ),
            }
            if spot:
                files.update(
                    {
                        "render_mask_thumbnail_key": (
                            f"{prefix}/mask-300.png",
                            "image/png",
                            self._file(source, item.get("mask_thumbnail")),
                        ),
                        "render_mask_key": (
                            f"{prefix}/mask-1000.png",
                            "image/png",
                            self._file(source, item.get("mask")),
                        ),
                    }
                )
            card_imports.append((card, item["signature"], files))

        for _, _, key, file, _, pack_key, pack_file in set_imports:
            storage.put_object(key, self._read(file), "image/webp")
            storage.put_object(pack_key, self._read(pack_file), "image/webp")
        for _, _, files in card_imports:
            for key, content_type, file in files.values():
                storage.put_object(key, self._read(file), content_type)

        with transaction.atomic():
            for card_set, signature, key, _, pack_signature, pack_key, _ in set_imports:
                card_set.render_back_signature = signature
                card_set.render_back_key = key
                card_set.render_pack_signature = pack_signature
                card_set.render_pack_key = pack_key
                card_set.save(
                    update_fields=[
                        "render_back_signature",
                        "render_back_key",
                        "render_pack_signature",
                        "render_pack_key",
                    ]
                )

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

    def _manifest(self, location: str) -> tuple[dict, Path | tuple[str, str]]:
        if location.startswith("s3://"):
            parsed = urlsplit(location)
            key = parsed.path.lstrip("/")
            if parsed.netloc != settings.AWS_STORAGE_BUCKET_NAME or not key:
                raise CommandError("The render manifest must be in the configured media bucket.")
            body = storage.client().get_object(Bucket=parsed.netloc, Key=key)["Body"].read()
            return json.loads(body), (parsed.netloc, str(PurePosixPath(key).parent))
        path = Path(location).resolve()
        return json.loads(path.read_text(encoding="utf-8")), path.parent

    def _file(self, source: Path | tuple[str, str], relative: object):
        if not isinstance(relative, str) or not relative:
            raise CommandError("The render manifest contains a missing file path.")
        if isinstance(source, Path):
            path = (source / relative).resolve()
            if not path.is_relative_to(source) or not path.is_file():
                raise CommandError(f"Missing render file: {relative}")
            return path
        bucket, prefix = source
        relative_path = PurePosixPath(relative)
        if relative_path.is_absolute() or ".." in relative_path.parts:
            raise CommandError(f"Invalid render file path: {relative}")
        key = str(PurePosixPath(prefix) / relative_path)
        try:
            storage.client().head_object(Bucket=bucket, Key=key)
        except Exception as error:
            raise CommandError(f"Missing render file: {relative}") from error
        return bucket, key

    def _read(self, file: Path | tuple[str, str]) -> bytes:
        if isinstance(file, Path):
            return file.read_bytes()
        bucket, key = file
        try:
            return storage.client().get_object(Bucket=bucket, Key=key)["Body"].read()
        except Exception as error:
            relative = PurePosixPath(key).name
            raise CommandError(f"Missing render file: {relative}") from error
