from datetime import UTC, datetime, timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from accounts.models import User
from common.monetization import (
    CREATOR_REWARD_PERCENT,
    CREDIT_BUNDLES,
    CREDIT_UNITS_PER_CREDIT,
    FREE_MONTHLY_PUBLICATIONS,
    SUBSCRIBER_MONTHLY_PUBLICATIONS,
    SUBSCRIPTION_BONUS_CREDITS,
)

from .models import (
    MembershipSettings,
    Provider,
    StarBalance,
    StarEntry,
    StarGrant,
    Subscription,
    SubscriptionPeriod,
)


class BillingError(Exception):
    pass


class PaymentMismatch(BillingError):
    # Provider data that can never satisfy the purchase, so a retried callback cannot fix it.
    pass


def lock_accounts(user_ids) -> dict:
    # All balance writers lock account rows first, in the same order, including own-set spends.
    return {
        user.pk: user
        for user in User.objects.select_for_update().filter(pk__in=user_ids).order_by("pk")
    }


def record_entry(
    balance: StarBalance, kind: str, units: int, *, grant=None, opening=None
) -> StarEntry:
    if units < 0 and balance.units + units < 0 and kind != StarEntry.Kind.REFUND:
        raise BillingError("Not enough Stars.")
    balance.units += units
    balance.save(update_fields=["units", "reward_remainder"])
    return StarEntry.objects.create(
        user_id=balance.user_id,
        kind=kind,
        units=units,
        balance_after=balance.units,
        remainder_after=balance.reward_remainder,
        grant=grant,
        opening=opening,
    )


def _validate_source(provider: str, reference: str) -> None:
    if (
        provider not in Provider.values
        or not isinstance(reference, str)
        or not reference.strip()
        or len(reference) > 255
    ):
        raise PaymentMismatch("Invalid payment reference.")


def _existing_grant(user: User, provider: str, reference: str, product: str) -> StarGrant | None:
    grant = StarGrant.objects.filter(provider=provider, reference=reference).first()
    if grant and (grant.user_id != user.pk or grant.product != product):
        raise PaymentMismatch("That payment is already attached to another purchase.")
    return grant


@transaction.atomic
def grant_bundle(user: User, provider: str, reference: str, product: str) -> StarGrant:
    # Only verified provider adapters may call grant functions; there is no client grant endpoint.
    _validate_source(provider, reference)
    bundle = CREDIT_BUNDLES.get(product)
    if bundle is None:
        raise PaymentMismatch("Unknown Stars bundle.")
    locked = lock_accounts([user.pk])[user.pk]
    if not locked.is_active:
        raise BillingError("This account is closed.")
    existing = _existing_grant(locked, provider, reference, product)
    if existing:
        return existing
    grant, created = StarGrant.objects.get_or_create(
        provider=provider,
        reference=reference,
        defaults={"user": locked, "product": product, "units": bundle.credit_units},
    )
    if not created:
        if grant.user_id != locked.pk or grant.product != product:
            raise PaymentMismatch("That payment is already attached to another purchase.")
        return grant
    balance, _ = StarBalance.objects.get_or_create(user=locked)
    record_entry(balance, StarEntry.Kind.GRANT, grant.units, grant=grant)
    return grant


@transaction.atomic
def grant_subscription_period(
    user: User,
    provider: str,
    reference: str,
    subscription_reference: str,
    starts_at: datetime,
    ends_at: datetime,
) -> SubscriptionPeriod:
    _validate_source(provider, reference)
    _validate_source(provider, subscription_reference)
    if timezone.is_naive(starts_at) or timezone.is_naive(ends_at) or ends_at <= starts_at:
        raise PaymentMismatch("Invalid subscription period.")
    locked = lock_accounts([user.pk])[user.pk]
    if not locked.is_active:
        raise BillingError("This account is closed.")
    existing = _existing_grant(locked, provider, reference, "subscription")
    if existing:
        period = existing.period
        if (
            existing.subscription_reference != subscription_reference
            or period.starts_at != starts_at
            or period.ends_at != ends_at
        ):
            raise PaymentMismatch("That payment has different subscription details.")
        return period
    if SubscriptionPeriod.objects.filter(
        subscription__user=locked, starts_at__lt=ends_at, ends_at__gt=starts_at
    ).exists():
        raise PaymentMismatch("You already have a subscription for that period.")
    if (
        Subscription.objects.filter(provider=provider, reference=subscription_reference)
        .exclude(user=locked)
        .exists()
    ):
        raise PaymentMismatch("That subscription belongs to another account.")
    current = Subscription.objects.filter(
        provider=provider, reference=subscription_reference
    ).first()
    if (
        current is None
        and SubscriptionPeriod.objects.filter(
            subscription__user=locked, ends_at__gt=timezone.now()
        ).exists()
    ):
        raise PaymentMismatch("You already have a subscription for that period.")
    subscription, _ = Subscription.objects.get_or_create(
        provider=provider,
        reference=subscription_reference,
        defaults={"user": locked, "auto_renews": True},
    )
    if subscription.user_id != locked.pk:
        raise PaymentMismatch("That subscription belongs to another account.")
    grant, created = StarGrant.objects.get_or_create(
        provider=provider,
        reference=reference,
        defaults={
            "user": locked,
            "product": "subscription",
            "subscription_reference": subscription_reference,
            "units": SUBSCRIPTION_BONUS_CREDITS * CREDIT_UNITS_PER_CREDIT,
        },
    )
    if not created:
        raise PaymentMismatch("That payment is already attached to another purchase.")
    period = SubscriptionPeriod.objects.create(
        subscription=subscription, grant=grant, starts_at=starts_at, ends_at=ends_at
    )
    balance, _ = StarBalance.objects.get_or_create(user=locked)
    record_entry(balance, StarEntry.Kind.GRANT, grant.units, grant=grant)
    return period


@transaction.atomic
def reverse_grant(grant: StarGrant, refunded: int, paid: int, *, restore: bool = False) -> None:
    """Take back the refunded share of a grant's Stars, even if that leaves the balance negative.

    Cards and other collectors' creator rewards are never touched. Refund totals only grow,
    except for a won dispute (restore=True), which can give Stars back.
    """
    if paid <= 0:
        raise PaymentMismatch("Refunded payment has no amount.")
    lock_accounts([grant.user_id])
    target = grant.units * min(max(refunded, 0), paid) // paid
    taken = -sum(
        StarEntry.objects.filter(grant=grant, kind=StarEntry.Kind.REFUND).values_list(
            "units", flat=True
        )
    )
    change = target - taken
    if change < 0 and not restore:
        return
    if change:
        balance, _ = StarBalance.objects.get_or_create(user_id=grant.user_id)
        record_entry(balance, StarEntry.Kind.REFUND, -change, grant=grant)
    if target == grant.units and hasattr(grant, "period"):
        # A fully refunded month ends now and loses its remaining bonus packs.
        period = grant.period
        now = timezone.now()
        if period.ends_at > now:
            period.ends_at = max(now, period.starts_at + timedelta(seconds=1))
        period.bonus_packs_remaining = 0
        period.save(update_fields=["ends_at", "bonus_packs_remaining"])


def trade_restricted(user: User) -> bool:
    # Collectors whose refunds left them owing Stars can't trade until the balance is back to zero.
    return StarBalance.objects.filter(user=user, units__lt=0).exists()


def active_period(user: User, at: datetime | None = None):
    at = at or timezone.now()
    return (
        SubscriptionPeriod.objects.filter(
            subscription__user=user,
            subscription__user__is_active=True,
            starts_at__lte=at,
            ends_at__gt=at,
        )
        .select_related("subscription")
        .first()
    )


def visible_badge(user: User) -> bool:
    return bool(
        settings.MONETIZATION_ENABLED
        and active_period(user)
        and not MembershipSettings.objects.filter(user=user, show_badge=False).exists()
    )


def monthly_publications(user: User, at: datetime | None = None) -> tuple[int, int, datetime]:
    from cards.models import CardSet

    at = (at or timezone.now()).astimezone(UTC)
    month_start = datetime(at.year, at.month, 1, tzinfo=UTC)
    next_month = datetime(at.year + (at.month == 12), at.month % 12 + 1, 1, tzinfo=UTC)
    used = CardSet.objects.filter(
        creator=user, published_at__gte=month_start, published_at__lt=next_month
    ).count()
    limit = (
        SUBSCRIBER_MONTHLY_PUBLICATIONS if active_period(user, at) else FREE_MONTHLY_PUBLICATIONS
    )
    return used, limit, next_month


def publishing_summary(user: User) -> dict:
    used, limit, resets_at = monthly_publications(user)
    return {
        "enabled": settings.MONETIZATION_ENABLED,
        "used": used,
        "limit": limit if settings.MONETIZATION_ENABLED else None,
        "resets_at": resets_at,
        "creator_reward_percent": CREATOR_REWARD_PERCENT,
    }


@transaction.atomic
def set_auto_renewal(user: User, provider: str, reference: str, auto_renews: bool) -> None:
    _validate_source(provider, reference)
    lock_accounts([user.pk])
    subscription = Subscription.objects.filter(
        user=user, provider=provider, reference=reference
    ).first()
    if subscription is None:
        raise BillingError("Subscription not found.")
    subscription.auto_renews = auto_renews
    subscription.save(update_fields=["auto_renews"])
