from pathlib import Path

from django.core.management.base import BaseCommand

from cards.catalogue import bootstrap_catalogue, export_photos, load_manifest, prepare_photos


class Command(BaseCommand):
    help = (
        "Create or verify the persistent production catalogue without changing published content."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--prepare-photos",
            action="store_true",
            help="Cache and validate catalogue photography without changing the database.",
        )
        parser.add_argument(
            "--photos",
            help="Read new photos from reviewed copies staged here (a directory or an s3:// "
            "prefix, one file per hash) instead of downloading them.",
        )
        parser.add_argument(
            "--export-photos",
            help="Write every reviewed photo to this directory under its hash, for staging.",
        )

    def handle(self, *args, **options):
        manifest = load_manifest()
        if options["export_photos"]:
            count = export_photos(Path(options["export_photos"]), manifest)
            self.stdout.write(self.style.SUCCESS(f"Exported {count} reviewed catalogue photos."))
            return
        photos = prepare_photos(manifest, staged=options["photos"])
        if options["prepare_photos"]:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Prepared {len(photos)} new catalogue photos; database unchanged."
                )
            )
            return
        created, verified = bootstrap_catalogue(manifest, photos)
        self.stdout.write(
            self.style.SUCCESS(
                f"Catalogue ready: {len(created)} created, {len(verified)} verified."
            )
        )
        for card_set in [*created, *verified]:
            state = "created" if card_set in created else "verified"
            self.stdout.write(f"  {state:>8}  /sets/{card_set.slug}")
