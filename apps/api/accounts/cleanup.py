import json
import logging
import urllib.request
from datetime import timedelta
from urllib.parse import urlsplit, urlunsplit

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from uploads import storage

from .models import AccountCleanup

log = logging.getLogger(__name__)


def erase_alerts(references: list[str], cursor: dict) -> dict:
    if not settings.ALERTS_URL and not settings.ALERTS_SECRET:
        return {"complete": True, "cursor": {}}
    url = urlsplit(settings.ALERTS_URL)
    if not settings.ALERTS_SECRET or not url.path.endswith("/alert"):
        raise ValueError("Alert erasure configuration is incomplete")
    request = urllib.request.Request(
        urlunsplit((url.scheme, url.netloc, url.path[:-6] + "/erase", "", "")),
        data=json.dumps(
            {"app": "miscellary", "references": references[:200], "cursor": cursor}
        ).encode(),
        headers={
            "Authorization": f"Bearer {settings.ALERTS_SECRET}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        result = json.load(response)
    progress = result.get("cursor")
    if (
        not isinstance(result.get("complete"), bool)
        or not isinstance(progress, dict)
        or any(
            not key.isdigit()
            or not isinstance(value, str)
            or (value != "done" and not value.isdigit())
            for key, value in progress.items()
        )
    ):
        raise ValueError("Alert relay returned invalid erasure progress")
    return result


def run_cleanup() -> bool:
    now = timezone.now()
    AccountCleanup.objects.filter(completed_at__lt=now - timedelta(days=30)).delete()
    with transaction.atomic():
        job = (
            AccountCleanup.objects.select_for_update(skip_locked=True)
            .filter(completed_at=None, next_attempt_at__lte=now)
            .filter(Q(lease_until=None) | Q(lease_until__lte=now))
            .order_by("next_attempt_at")
            .first()
        )
        if job is None:
            return False
        job.lease_until = now + timedelta(minutes=10)
        job.save(update_fields=["lease_until"])
    try:
        if not job.alerts_complete:
            result = erase_alerts(job.references, job.cursor)
            job.cursor = result["cursor"]
            job.alerts_complete = result["complete"]
            if job.alerts_complete and len(job.references) > 200:
                job.references = job.references[200:]
                job.cursor = {}
                job.alerts_complete = False
            job.save(update_fields=["references", "cursor", "alerts_complete"])
        if job.alerts_complete:
            for key in job.storage_keys[:20]:
                storage.delete_object(key)
            job.storage_keys = job.storage_keys[20:]
            if not job.storage_keys:
                job.completed_at = timezone.now()
                job.references = []
                job.cursor = {}
    except Exception:  # noqa: BLE001 - leave durable progress for the next attempt
        log.warning("Account cleanup %s will retry", job.pk)
    job.lease_until = None
    job.next_attempt_at = timezone.now() + timedelta(minutes=1)
    job.save()
    return True
