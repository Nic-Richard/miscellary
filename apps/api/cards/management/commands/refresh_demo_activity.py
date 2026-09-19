from django.core.management.base import BaseCommand

from cards.demo_activity import refresh_demo_activity


class Command(BaseCommand):
    help = "Replace synthetic activity belonging only to production demo accounts."

    def add_arguments(self, parser):
        parser.add_argument(
            "--include-trades",
            action="store_true",
            help="Add demo-only trade offers for inbox testing.",
        )

    def handle(self, *args, **options):
        refresh_demo_activity(include_trades=options["include_trades"])
        suffix = " including trades" if options["include_trades"] else ""
        self.stdout.write(self.style.SUCCESS(f"Refreshed demo activity{suffix}."))
