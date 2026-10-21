import hashlib
import hmac
import json
import re
import time
from uuid import UUID

from django.conf import settings
from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from cards.removal import remove_set
from social.models import Feedback, Report

from .models import ModerationAction


class ActionError(Exception):
    def __init__(self, message: str, status: int = 409):
        super().__init__(message)
        self.status = status


def parse_action(raw: bytes, headers) -> dict:
    secret = settings.ALERTS_ACTION_SECRET
    if len(secret) < 32:
        raise ActionError("Moderation is not configured", 503)
    timestamp = headers.get("X-Action-Timestamp", "")
    signature = headers.get("X-Action-Signature", "")
    if (
        len(raw) > 65536
        or not re.fullmatch(r"\d{1,12}", timestamp)
        or not re.fullmatch(r"[a-f0-9]{64}", signature)
    ):
        raise ActionError("Invalid action signature", 401)
    expected = hmac.new(
        secret.encode(), timestamp.encode() + b"." + raw, hashlib.sha256
    ).hexdigest()
    if abs(time.time() - int(timestamp)) > 300 or not hmac.compare_digest(expected, signature):
        raise ActionError("Invalid action signature", 401)
    try:
        data = json.loads(raw)
        if not isinstance(data, dict) or not isinstance(data.get("target"), dict):
            raise ValueError
        if not isinstance(data.get("requestId"), str) or not isinstance(
            data["target"].get("id"), str
        ):
            raise ValueError
        UUID(data["requestId"])
        UUID(data["target"]["id"])
        if data["action"] not in {
            "inspect",
            "resolve",
            "dismiss",
            "remove",
            "reopen",
            "ban",
            "unban",
        }:
            raise ValueError
    except (ValueError, TypeError, KeyError):
        raise ActionError("Invalid action request", 400) from None
    actor = data.get("actor") or {}
    if not isinstance(actor, dict):
        raise ActionError("Invalid moderator identity", 400)
    if data["action"] == "inspect" and actor.get("id") == "system":
        return data
    try:
        permissions = str(actor.get("permissions", ""))
        permitted = bool(re.fullmatch(r"\d{1,30}", permissions)) and (
            int(permissions) & ((1 << 3) | (1 << 40))
        )
    except (ValueError, TypeError):
        permitted = 0
    if not permitted or not re.fullmatch(r"\d{1,20}", str(actor.get("id", ""))):
        raise ActionError("Moderator permission is required", 403)
    if not isinstance(actor.get("name"), str) or len(actor["name"]) > 100:
        raise ActionError("Invalid moderator identity", 400)
    if data["action"] != "inspect" and not isinstance(data.get("expectedVersion"), str):
        raise ActionError("Review the current report first", 400)
    return data


def _state(target, kind: str) -> dict:
    references = [str(target.pk)]
    actions = ["resolve", "dismiss"]
    fingerprint = ""
    confirmations = {"reopen": "Reopen this report for review. Removed content is not restored."}
    if kind == "feedback":
        status = "resolved" if target.resolved else "open"
        title, summary = target.get_kind_display(), target.message
        if target.user_id:
            references.append(str(target.user_id))
        confirmation = "Mark this feedback handled."
    else:
        status = target.status
        references.append(str(target.reporter_id))
        if target.reported_user_id:
            references.append(str(target.reported_user_id))
            account = target.reported_user
            fingerprint += f"{account.is_active}:{account.deleted_at}"
            if not account.deleted_at and not account.is_staff and not account.is_superuser:
                actions.append("ban" if account.is_active else "unban")
                confirmations["ban"] = (
                    f"Ban @{account.username} from signing in. "
                    "Collections and subscriptions are kept. This can be undone."
                )
                confirmations["unban"] = (
                    f"Restore sign-in access for @{account.username}. "
                    "No deleted account or removed content is restored."
                )
        title, summary = target.get_reason_display(), target.details
        removable = target.comment or target.lounge_post or target.lounge_reply
        card_set = target.card_set or (target.card.card_set if target.card else None)
        if card_set:
            references.append(str(card_set.creator_id))
            fingerprint = (
                str(card_set.updated_at) if hasattr(card_set, "updated_at") else str(card_set)
            )
            fingerprint += str(card_set.is_published)
            if target.card:
                fingerprint += str(target.card.image_id)
            title += f": {card_set.title}"
            confirmation = (
                f"Remove the entire set {card_set.title} and wipe every collected copy. "
                "This cannot be undone."
            )
            if card_set.is_published:
                actions.append("remove")
        elif removable:
            references.append(str(removable.author_id))
            fingerprint = str(removable.deleted_at)
            title += f": {getattr(removable, 'title', 'Comment or reply')}"
            summary += "\n" + removable.body
            confirmation = "Remove this reported comment or Lounge item for all collectors."
            if removable.deleted_at is None:
                actions.append("remove")
        else:
            confirmation = "Resolve this report; no account suspension or deletion is performed."
    latest = (
        ModerationAction.objects.filter(target_kind=kind, target_id=str(target.pk))
        .order_by("-created_at")
        .first()
    )
    if kind == "feedback" and target.resolved and latest:
        status = latest.result["status"]
    version_data = (
        f"{target.pk}:{status}:{target.updated_at.isoformat()}:{fingerprint}:"
        f"{latest.pk if latest else None}:{title}:{summary}"
    )
    version = hashlib.sha256(version_data.encode()).hexdigest()
    actor = latest.result.get("actor") if latest and status != "open" else None
    return {
        "ok": True,
        "status": status,
        "version": version,
        "title": title,
        "summary": summary[:1500],
        "actions": actions
        if status == "open"
        else ["reopen", *[a for a in actions if a in {"ban", "unban"}]],
        "confirmations": confirmations,
        "confirmation": confirmation,
        "references": references,
        "actor": actor,
    }


@transaction.atomic
def moderate(data: dict) -> dict:
    kind = data["target"].get("kind")
    target: Report | Feedback | None
    if kind == "report":
        target = Report.objects.select_for_update().filter(pk=data["target"]["id"]).first()
    elif kind == "feedback":
        target = Feedback.objects.select_for_update().filter(pk=data["target"]["id"]).first()
    else:
        raise ActionError("Invalid moderation target", 400)
    if target is None:
        raise ActionError("Report is no longer available", 404)
    if isinstance(target, Report):
        for field in (
            "card_set",
            "card",
            "comment",
            "lounge_post",
            "lounge_reply",
            "reported_user",
        ):
            subject = getattr(target, field)
            if subject is not None:
                subject = type(subject).objects.select_for_update().get(pk=subject.pk)
                setattr(target, field, subject)
        if target.card and not target.card_set:
            subject = target.card.card_set
            target.card.card_set = type(subject).objects.select_for_update().get(pk=subject.pk)
    previous = ModerationAction.objects.filter(pk=data["requestId"]).first()
    if previous:
        if (previous.target_kind, previous.target_id, previous.action) != (
            kind,
            str(target.pk),
            data["action"],
        ):
            raise ActionError("That request belongs to another action")
        return previous.result
    state = _state(target, kind)
    if data["action"] == "inspect":
        return state
    if state["status"] != "open" and data["action"] in {"resolve", "dismiss", "remove"}:
        return {**state, "changed": False, "summary": "This report was already handled in the app"}
    if data["expectedVersion"] != state["version"] or data["action"] not in state["actions"]:
        raise ActionError("Report changed; review it again")
    if data["action"] == "remove":
        assert isinstance(target, Report)
        if target.card_set or target.card:
            card_set = target.card_set or (target.card.card_set if target.card else None)
            assert card_set is not None
            remove_set(card_set)
        else:
            item = target.comment or target.lounge_post or target.lounge_reply
            assert item is not None
            item.deleted_at = timezone.now()
            item.save(update_fields=["deleted_at"])
    if data["action"] in {"ban", "unban"}:
        assert isinstance(target, Report) and target.reported_user is not None
        target.reported_user.is_active = data["action"] == "unban"
        target.reported_user.save(update_fields=["is_active"])
    status = (
        "open"
        if data["action"] == "reopen"
        else "dismissed"
        if data["action"] == "dismiss"
        else "resolved"
    )
    if isinstance(target, Report):
        target.status = status
        target.save(update_fields=["status", "updated_at"])
    else:
        target.resolved = status != "open"
        target.save(update_fields=["resolved", "updated_at"])
    summary = {
        "remove": "Reported content removed and report resolved",
        "ban": "User banned; report resolved",
        "unban": "User unbanned; report resolved",
        "reopen": "Report reopened",
    }.get(data["action"], f"Report {status}")
    result = {
        "ok": True,
        "changed": True,
        "status": status,
        "summary": summary,
        "actor": data["actor"],
        "requestId": data["requestId"],
        "at": int(time.time() * 1000),
    }
    receipt = ModerationAction.objects.create(
        request_id=data["requestId"],
        target_kind=kind,
        target_id=str(target.pk),
        action=data["action"],
        actor_id=data["actor"]["id"],
        actor_name=data["actor"]["name"],
        result=result,
    )
    current = _state(target, kind)
    result.update({key: current[key] for key in ("version", "actions", "confirmations")})
    receipt.result = result
    receipt.save(update_fields=["result"])
    return result


@csrf_exempt
@require_POST
def discord_action(request):
    try:
        return JsonResponse(moderate(parse_action(request.body, request.headers)))
    except ActionError as exc:
        return JsonResponse({"ok": False, "error": str(exc)}, status=exc.status)
