import time
from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.db import close_old_connections
from django.utils import timezone

from billing import play
from billing.actions import BillingError

DAY_SECONDS = 24 * 60 * 60


class Command(BaseCommand):
    help = "Apply Google Play refunds from the last few days, in case a notification was missed."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=3)
        parser.add_argument("--watch", action="store_true")

    def handle(self, *args, days: int, **options):
        if not 1 <= days <= 30:
            raise CommandError("Use between 1 and 30 days.")
        if not options["watch"]:
            try:
                count = play.sync_voided(timezone.now() - timedelta(days=days))
            except BillingError as exc:
                raise CommandError(str(exc)) from exc
            self.stdout.write(f"Checked {count} refunded Google Play purchases.")
            return
        # Runs beside the web server; overlapping days mean a restart or failed day loses nothing.
        while True:
            try:
                if play.configured():
                    count = play.sync_voided(timezone.now() - timedelta(days=days))
                    self.stdout.write(f"Checked {count} refunded Google Play purchases.")
            except Exception as error:  # noqa: BLE001 - try again tomorrow after a Play or database failure
                self.stderr.write(f"Play refund check will retry ({type(error).__name__}).")
            finally:
                close_old_connections()
            time.sleep(DAY_SECONDS)
