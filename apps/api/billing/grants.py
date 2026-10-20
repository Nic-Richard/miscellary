from datetime import UTC, datetime
from uuid import UUID, uuid5

from django.db import models, transaction
from django.utils import timezone

from accounts.models import User
from common.monetization import CREDIT_UNITS_PER_CREDIT, SUBSCRIPTION_BONUS_CREDITS

from .actions import BillingError, lock_accounts, record_entry, sync_supporter
from .models import (
    ComplimentarySupporter,
    Provider,
    StarBalance,
    StarEntry,
    Subscription,
    SubscriptionPeriod,
    TicketGrant,
)


def _reason(reason: str, actor: User | None) -> str:
    if not isinstance(reason, str) or not reason.strip() or len(reason.strip()) > 255:
        raise BillingError("A reason of up to 255 characters is required.")
    if actor and (not actor.is_active or not actor.is_staff):
        raise BillingError("Only active staff can grant account benefits.")
    return reason.strip()


@transaction.atomic
def grant_tickets(
    user: User, tickets: int, reason: str, reference: UUID, *, actor: User | None = None
) -> TicketGrant:
    reason = _reason(reason, actor)
    if isinstance(tickets, bool) or not isinstance(tickets, int) or not 1 <= tickets <= 1_000_000:
        raise BillingError("Grant between 1 and 1,000,000 whole tickets.")
    if not isinstance(reference, UUID):
        raise BillingError("A grant reference is required.")
    locked = lock_accounts([user.pk])[user.pk]
    if not locked.is_active:
        raise BillingError("This account is closed.")
    grant, created = TicketGrant.objects.get_or_create(
        pk=reference,
        defaults={"user": locked, "tickets": tickets, "reason": reason, "granted_by": actor},
    )
    if grant.user_id != locked.pk or grant.tickets != tickets or grant.reason != reason:
        raise BillingError("That reference belongs to a different ticket grant.")
    if created:
        balance, _ = StarBalance.objects.get_or_create(user=locked)
        grant.entry = record_entry(balance, StarEntry.Kind.GIFT, tickets * CREDIT_UNITS_PER_CREDIT)
        grant.save(update_fields=["entry"])
    return grant


@transaction.atomic
def grant_supporter(
    user: User,
    reason: str,
    reference: UUID,
    *,
    expires_at: datetime | None = None,
    actor: User | None = None,
) -> ComplimentarySupporter:
    reason = _reason(reason, actor)
    if not isinstance(reference, UUID):
        raise BillingError("A grant reference is required.")
    locked = lock_accounts([user.pk])[user.pk]
    if not locked.is_active:
        raise BillingError("This account is closed.")
    existing = ComplimentarySupporter.objects.filter(pk=reference).first()
    if existing:
        if (
            existing.user_id != locked.pk
            or existing.reason != reason
            or existing.expires_at != expires_at
        ):
            raise BillingError("That reference belongs to a different Supporter grant.")
        return existing
    now = timezone.now()
    if expires_at and (timezone.is_naive(expires_at) or expires_at <= now):
        raise BillingError("Choose an expiry in the future, or leave it empty.")
    if (
        ComplimentarySupporter.objects.filter(user=locked, revoked_at__isnull=True)
        .filter(models.Q(expires_at__isnull=True) | models.Q(expires_at__gt=now))
        .exists()
    ):
        raise BillingError("This account already has complimentary Supporter access.")
    subscription, _ = Subscription.objects.get_or_create(
        provider=Subscription.COMPLIMENTARY,
        reference=str(reference),
        defaults={"user": locked, "auto_renews": False},
    )
    if subscription.user_id != locked.pk:
        raise BillingError("That reference belongs to another account.")
    grant = ComplimentarySupporter.objects.create(
        pk=reference,
        user=locked,
        subscription=subscription,
        reason=reason,
        expires_at=expires_at,
        granted_by=actor,
    )
    sync_supporter(locked.pk)
    return grant


@transaction.atomic
def revoke_supporter(grant: ComplimentarySupporter) -> None:
    lock_accounts([grant.user_id])
    grant = ComplimentarySupporter.objects.get(pk=grant.pk)
    if grant.revoked_at is None:
        grant.revoked_at = timezone.now()
        grant.save(update_fields=["revoked_at"])
        sync_supporter(grant.user_id)


@transaction.atomic
def complimentary_period(user: User, at: datetime) -> SubscriptionPeriod | None:
    grants = ComplimentarySupporter.objects.filter(
        user=user,
        revoked_at__isnull=True,
        created_at__lte=at,
    ).filter(models.Q(expires_at__isnull=True) | models.Q(expires_at__gt=at))
    if not grants.exists():
        return None
    locked = lock_accounts([user.pk])[user.pk]
    if not locked.is_active:
        return None
    paid = (
        SubscriptionPeriod.objects.filter(
            subscription__user=locked,
            subscription__provider__in=Provider.values,
            starts_at__lte=at,
            ends_at__gt=at,
        )
        .select_related("subscription")
        .first()
    )
    if paid:
        return paid
    grant = grants.first()
    if grant is None:
        return None
    # Benefits accrue in UTC calendar months, without creating payment receipts or renewals.
    at = at.astimezone(UTC)
    month = datetime(at.year, at.month, 1, tzinfo=UTC)
    next_month = datetime(at.year + (at.month == 12), at.month % 12 + 1, 1, tzinfo=UTC)
    starts_at = max(month, grant.created_at)
    ends_at = min(next_month, grant.expires_at) if grant.expires_at else next_month
    period, created = SubscriptionPeriod.objects.get_or_create(
        subscription=grant.subscription,
        starts_at=starts_at,
        defaults={"ends_at": ends_at},
    )
    if created:
        grant_tickets(
            locked,
            SUBSCRIPTION_BONUS_CREDITS,
            "Complimentary Supporter monthly tickets",
            uuid5(grant.pk, month.isoformat()),
        )
    return period
