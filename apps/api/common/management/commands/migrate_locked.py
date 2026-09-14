from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import connection

LOCK_ID = 742_165_931


class Command(BaseCommand):
    help = "Apply migrations under a PostgreSQL advisory lock."

    def handle(self, *args, **options):
        if connection.vendor != "postgresql":
            call_command("migrate", interactive=False, verbosity=options["verbosity"])
            return

        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_lock(%s)", [LOCK_ID])
            try:
                call_command("migrate", interactive=False, verbosity=options["verbosity"])
            finally:
                cursor.execute("SELECT pg_advisory_unlock(%s)", [LOCK_ID])
