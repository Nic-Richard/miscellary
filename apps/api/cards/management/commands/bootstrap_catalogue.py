from django.core.management.base import BaseCommand

from cards.catalogue import bootstrap_catalogue, load_manifest, prepare_photos, required_photo_specs


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

    def handle(self, *args, **options):
        manifest = load_manifest()
        photos = prepare_photos(manifest)
        if options["prepare_photos"]:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Prepared {len(required_photo_specs(manifest))} catalogue photos; "
                    "database unchanged."
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
