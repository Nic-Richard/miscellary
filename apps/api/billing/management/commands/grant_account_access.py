from uuid import UUID

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import User
from billing.actions import BillingError
from billing.grants import grant_supporter, grant_tickets


class Command(BaseCommand):
    help = "Grant complimentary Supporter access and/or tickets, without creating a purchase."

    def add_arguments(self, parser):
        parser.add_argument("email")
        parser.add_argument("--reference", required=True, type=UUID)
        parser.add_argument("--reason", required=True)
        parser.add_argument("--tickets", type=int, default=0)
        parser.add_argument("--supporter", action="store_true")
        parser.add_argument("--actor", help="Staff username; omitted for a trusted server task")

    @transaction.atomic
    def handle(self, *args, **options):
        user = User.objects.filter(email__iexact=options["email"]).first()
        if user is None:
            raise CommandError("Account not found.")
        if options["tickets"] < 0 or not (options["tickets"] or options["supporter"]):
            raise CommandError("Specify --supporter and/or a positive --tickets amount.")
        actor = None
        if options["actor"]:
            actor = User.objects.filter(
                username=options["actor"], is_staff=True, is_active=True
            ).first()
            if actor is None:
                raise CommandError("Active staff account not found.")
        try:
            if options["supporter"]:
                grant_supporter(user, options["reason"], options["reference"], actor=actor)
            if options["tickets"]:
                grant_tickets(
                    user, options["tickets"], options["reason"], options["reference"], actor=actor
                )
        except BillingError as exc:
            raise CommandError(str(exc)) from exc
        self.stdout.write(
            self.style.SUCCESS("Account grants applied; existing references are not repeated.")
        )
