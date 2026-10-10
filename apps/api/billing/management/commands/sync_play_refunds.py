from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from billing import play
from billing.actions import BillingError


class Command(BaseCommand):
    help = "Apply Google Play refunds from the last few days, in case a notification was missed."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=3)

    def handle(self, *args, days: int, **options):
        if not 1 <= days <= 30:
            raise CommandError("Use between 1 and 30 days.")
        try:
            count = play.sync_voided(timezone.now() - timedelta(days=days))
        except BillingError as exc:
            raise CommandError(str(exc)) from exc
        self.stdout.write(f"Checked {count} refunded Google Play purchases.")
