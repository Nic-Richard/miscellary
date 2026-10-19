import time

from django.core.management.base import BaseCommand
from django.db import close_old_connections

from accounts.cleanup import run_cleanup


class Command(BaseCommand):
    help = "Retry account-linked alert and private-upload cleanup."

    def add_arguments(self, parser):
        parser.add_argument("--watch", action="store_true")

    def handle(self, *args, **options):
        while True:
            try:
                for _ in range(20):
                    if not run_cleanup():
                        break
            except Exception as error:  # noqa: BLE001 - reconnect after infrastructure failures
                if not options["watch"]:
                    raise
                self.stderr.write(f"Cleanup worker will retry ({type(error).__name__}).")
            finally:
                close_old_connections()
            if not options["watch"]:
                return
            time.sleep(30)
