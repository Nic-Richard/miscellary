from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from cards.catalogue import _pack_art_id, _slug, bootstrap_catalogue, load_manifest
from cards.models import CardSet
from packs.models import OwnedCard
from uploads.models import Image

# A cutout the pack art never places is still stored, so pack images are found by
# identity as well as through the layers, far enough to cover any earlier design.
PACK_ART_SLOTS = 8


class Command(BaseCommand):
    help = "Remove catalogue sets from a development database and create them again."

    def add_arguments(self, parser):
        parser.add_argument("slugs", nargs="+")

    def handle(self, *args, **options):
        # Published sets are frozen everywhere else; only a development catalogue is rebuilt.
        if not settings.DEBUG:
            raise CommandError("rebuild_catalogue_set only runs in development.")
        manifest = load_manifest()
        codes = {
            _slug(definition["title"]): definition["set_code"] for definition in manifest["sets"]
        }
        unknown = [slug for slug in options["slugs"] if slug not in codes]
        if unknown:
            raise CommandError(f"Not in the catalogue manifest: {', '.join(unknown)}")
        with transaction.atomic():
            for slug in options["slugs"]:
                # Found by code rather than slug, so a set renamed in the manifest is replaced.
                for card_set in CardSet.objects.filter(set_code=codes[slug], set_code_suffix="01"):
                    self._remove(card_set)
            created, _ = bootstrap_catalogue(manifest)
        for card_set in created:
            self.stdout.write(self.style.SUCCESS(f"  rebuilt  /sets/{card_set.slug}"))

    def _remove(self, card_set: CardSet) -> None:
        copies = OwnedCard.objects.filter(card__card_set=card_set)
        if copies.exclude(owner__is_demo=True).exists():
            raise CommandError(f"{card_set.slug} has copies owned by real accounts.")
        images = {str(card.image_id) for card in card_set.cards.all()}
        images |= {layer["image_id"] for layer in card_set.pack_layers if layer.get("image_id")}
        images |= {str(_pack_art_id(card_set.title, index)) for index in range(PACK_ART_SLOTS)}
        copies.delete()
        card_set.delete()
        Image.objects.filter(pk__in=images).delete()
