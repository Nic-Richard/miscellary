import os

from django.core.management.base import BaseCommand, CommandError

from accounts.models import User


class Command(BaseCommand):
    help = "Create the first administrator from deployment environment variables."

    def handle(self, *args, **options):
        email = os.environ.get("INITIAL_ADMIN_EMAIL", "").strip().lower()
        username = os.environ.get("INITIAL_ADMIN_USERNAME", "").strip().lower()
        password = os.environ.get("INITIAL_ADMIN_PASSWORD", "")
        if not email or not username or not password:
            raise CommandError(
                "INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_USERNAME, and "
                "INITIAL_ADMIN_PASSWORD are required."
            )

        existing = User.objects.filter(email=email).first()
        if existing:
            if not existing.is_superuser or existing.username != username:
                raise CommandError("The initial administrator email is already in use.")
            self.stdout.write("Initial administrator already exists.")
            return

        if User.objects.filter(username=username).exists():
            raise CommandError("The initial administrator username is already in use.")

        User.objects.create_superuser(email=email, username=username, password=password)
        self.stdout.write(self.style.SUCCESS("Created the initial administrator."))
