import hashlib
import hmac
import json
import logging
import threading
import time
import traceback
import urllib.request

from django.conf import settings
from django.db import transaction

log = logging.getLogger(__name__)


def configured() -> bool:
    return bool(settings.ALERTS_URL and settings.ALERTS_SECRET)


def _deliver(payload: dict) -> None:
    raw = json.dumps(payload).encode()
    headers = {
        "Authorization": f"Bearer {settings.ALERTS_SECRET}",
        "Content-Type": "application/json",
    }
    secret = getattr(settings, "ALERTS_ACTION_SECRET", "")
    if secret:
        timestamp = str(int(time.time()))
        headers["X-Alert-Timestamp"] = timestamp
        headers["X-Alert-Signature"] = hmac.new(
            secret.encode(), timestamp.encode() + b"." + raw, hashlib.sha256
        ).hexdigest()
    request = urllib.request.Request(
        settings.ALERTS_URL,
        data=raw,
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=5):
            pass
    except Exception as exc:  # noqa: BLE001 - an alert must never break the caller
        log.warning("Alert not sent: %s", exc)


def _dispatch(payload: dict) -> None:
    threading.Thread(target=_deliver, args=(payload,), daemon=True).start()


def _payload(kind: str, title: str, description: str, url: str, fields: dict, key: str) -> dict:
    return {
        "app": "miscellary",
        "type": kind,
        "title": title,
        "description": description,
        "url": url,
        "fields": [{"name": k, "value": str(v)} for k, v in fields.items() if v not in (None, "")],
        "key": key,
    }


def send(
    kind: str,
    title: str,
    *,
    description: str = "",
    url: str = "",
    fields: dict | None = None,
    key: str = "",
    account_id: str | None = None,
) -> None:
    """Post to the alerts relay once the current transaction commits, off the request thread."""
    if not configured():
        return
    data = {"Account": account_id, **(fields or {})} if account_id else fields or {}
    payload = _payload(kind, title, description, url, data, key)

    def dispatch():
        if account_id:
            from accounts.models import User

            if not User.objects.filter(pk=account_id, is_active=True, deleted_at=None).exists():
                return
        _dispatch(payload)

    transaction.on_commit(dispatch)


def web_url(path: str) -> str:
    return f"{settings.WEB_URL.rstrip('/')}{path}"


class AlertHandler(logging.Handler):
    """Sends ERROR logs, including unhandled exceptions behind 500s, to the errors channel."""

    def emit(self, record: logging.LogRecord) -> None:
        if not configured() or record.name == __name__:
            return
        try:
            title = record.getMessage().splitlines()[0][:200] or record.name
            key = f"{record.pathname}:{record.lineno}"
            description = ""
            if record.exc_info and record.exc_info[1] is not None:
                exc = record.exc_info[1]
                frames = traceback.extract_tb(record.exc_info[2])
                if frames:
                    key = f"{type(exc).__name__}:{frames[-1].filename}:{frames[-1].lineno}"
                description = "```\n" + "".join(traceback.format_exception(exc))[-3000:] + "\n```"
            request = getattr(record, "request", None)
            fields = {"Request": f"{request.method} {request.path}"} if request else {}
            # Not on_commit: the failing request's transaction is usually being rolled back.
            _dispatch(_payload("errors", title, description, "", fields, key))
        except Exception:  # noqa: BLE001
            self.handleError(record)
