"""Tag merge suggestions are posted to the tags channel on Discord, where a
moderator merges or dismisses them through the moderation endpoint."""

import hashlib

from django.db import transaction
from django.utils import timezone

from common import alerts

from . import tag_groups
from .models import Tag, TagMergeSuggestion

KIND = "tag-merge"
# The relay holds each channel to a few posts at a time, so the rest wait for the next pass.
ALERTS_PER_PASS = 10
STATUS: dict[str, str] = {
    TagMergeSuggestion.Status.PENDING: "open",
    TagMergeSuggestion.Status.MERGED: "merged",
    TagMergeSuggestion.Status.DISMISSED: "dismissed",
}
ACTIONS = {"open": ["merge", "dismiss"], "merged": ["unmerge"], "dismissed": ["reopen"]}


def _main(tag: Tag) -> Tag:
    return tag.canonical or tag


def _title(suggestion: TagMergeSuggestion) -> str:
    return f"Merge #{suggestion.tag.slug} into #{_main(suggestion.into).slug}?"


def _summary(suggestion: TagMergeSuggestion) -> str:
    tag, into = suggestion.tag, _main(suggestion.into)
    counts = dict(
        tag_groups.with_group_counts(Tag.objects.filter(pk__in=[tag.pk, into.pk])).values_list(
            "pk", "set_count"
        )
    )
    return (
        f"{tag.label} is on {counts.get(tag.pk, 0)} published set(s), "
        f"{into.label} on {counts.get(into.pk, 0)}. "
        f"Meaning match {round(suggestion.similarity * 100)}%."
    )


def send_alerts() -> int:
    """Post pending suggestions that haven't been posted yet. Returns how many were sent."""
    if not alerts.configured():
        return 0
    batch = list(
        TagMergeSuggestion.objects.filter(
            status=TagMergeSuggestion.Status.PENDING, alerted_at__isnull=True
        )
        .select_related("tag", "into__canonical")
        .order_by("-similarity")[:ALERTS_PER_PASS]
    )
    with transaction.atomic():
        for suggestion in batch:
            alerts.send(
                "tags",
                _title(suggestion),
                description=_summary(suggestion),
                key=f"tag-merge:{suggestion.pk}",
                target={"kind": KIND, "id": str(suggestion.pk)},
            )
        TagMergeSuggestion.objects.filter(pk__in=[s.pk for s in batch]).update(
            alerted_at=timezone.now()
        )
    return len(batch)


def state(suggestion: TagMergeSuggestion, latest_receipt: str | None) -> dict:
    status = STATUS[suggestion.status]
    tag, into = suggestion.tag, _main(suggestion.into)
    version = hashlib.sha256(
        f"{suggestion.pk}:{status}:{tag.canonical_id}:{into.pk}:{latest_receipt}".encode()
    ).hexdigest()
    return {
        "ok": True,
        "status": status,
        "version": version,
        "title": _title(suggestion),
        "summary": _summary(suggestion),
        "actions": ACTIONS[status],
        "confirmations": {
            "merge": (
                f"Group #{tag.slug} under #{into.slug}, so searching either finds sets "
                "tagged with both. Sets keep their own tags. This can be undone."
            ),
            "unmerge": f"Split #{tag.slug} back out as its own tag and ask about it again.",
            "reopen": "Ask about this pair again.",
        },
        "references": [str(suggestion.pk), tag.slug, into.slug],
    }


def decide(suggestion: TagMergeSuggestion, action: str) -> tuple[str, str]:
    """Apply a decision and return the new status and a one-line summary."""
    if action == "merge":
        tag_groups.merge(suggestion.tag, suggestion.into)
        TagMergeSuggestion.objects.filter(pk=suggestion.pk).update(
            status=TagMergeSuggestion.Status.MERGED, decided_at=timezone.now()
        )
        suggestion.refresh_from_db()
        return "merged", f"#{suggestion.tag.slug} merged into #{_main(suggestion.into).slug}"
    if action == "unmerge":
        suggestion.tag.canonical = None
        suggestion.tag.save(update_fields=["canonical"])
        summary = f"#{suggestion.tag.slug} is its own tag again"
    else:
        summary = "Suggestion dismissed" if action == "dismiss" else "Suggestion reopened"
    suggestion.status = (
        TagMergeSuggestion.Status.DISMISSED
        if action == "dismiss"
        else TagMergeSuggestion.Status.PENDING
    )
    suggestion.decided_at = timezone.now() if action == "dismiss" else None
    suggestion.save(update_fields=["status", "decided_at"])
    return STATUS[suggestion.status], summary
