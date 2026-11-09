import time

from django.core.management.base import BaseCommand
from django.db import close_old_connections

from cards import embeddings, tag_groups

PAUSE_SECONDS = 5 * 60
SWEEP_SECONDS = 24 * 60 * 60


class Command(BaseCommand):
    help = "Embed new or changed sets, cards and tags for search, and queue tag merge suggestions."

    def add_arguments(self, parser):
        parser.add_argument("--sweep", action="store_true", help="Recheck every findable row.")
        parser.add_argument("--watch", action="store_true")

    def handle(self, *args, **options):
        if not options["watch"]:
            self._run(sweep=options["sweep"])
            return
        last_sweep = None
        while True:
            try:
                sweep = last_sweep is None or time.monotonic() - last_sweep > SWEEP_SECONDS
                self._run(sweep=sweep)
                if sweep:
                    last_sweep = time.monotonic()
            except Exception as error:  # noqa: BLE001 - try again on the next pass after any failure
                self.stderr.write(f"Search refresh will retry ({type(error).__name__}).")
            finally:
                close_old_connections()
            time.sleep(PAUSE_SECONDS)

    def _run(self, *, sweep: bool) -> None:
        counts = embeddings.refresh(sweep=sweep)
        if any(counts.values()):
            self.stdout.write(f"Search refresh: {counts}")
        if sweep and embeddings.enabled():
            queued = tag_groups.suggest_merges()
            if queued:
                self.stdout.write(f"Queued {queued} tag merge suggestion(s).")
