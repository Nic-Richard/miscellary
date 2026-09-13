from django.db import IntegrityError, transaction

from .models import Notification


def _target(card_set=None, card=None, comment=None) -> dict:
    return {"card_set": card_set, "card": card, "comment": comment}


def notify(recipient, actor, kind: str, **target) -> Notification | None:
    """One unread notification per actor, kind and target.

    The database decides, not a check here: a read-then-create pair can let two
    simultaneous identical requests both through. The savepoint keeps the
    rejection from poisoning a transaction the caller may have opened.
    """
    if recipient is None or actor is None or recipient.pk == actor.pk:
        return None
    try:
        with transaction.atomic():
            return Notification.objects.create(
                recipient=recipient, actor=actor, kind=kind, **_target(**target)
            )
    except IntegrityError:
        return None


def withdraw(recipient, actor, kind: str, **target) -> None:
    if recipient is None or actor is None:
        return
    Notification.objects.filter(
        recipient=recipient, actor=actor, kind=kind, read_at__isnull=True, **_target(**target)
    ).delete()


def unread_count(user) -> int:
    return Notification.objects.filter(recipient=user, read_at__isnull=True).count()
