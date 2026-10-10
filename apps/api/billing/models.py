import uuid

from django.conf import settings
from django.db import models

from common.monetization import SUBSCRIPTION_BONUS_PACKS


class Provider(models.TextChoices):
    WEB = "web", "Website"
    PLAY = "play", "Google Play"


class StarBalance(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="star_balance"
    )
    # Refunds of spent Stars can leave this below zero; see actions.reverse_grant.
    units = models.BigIntegerField(default=0)
    reward_remainder = models.PositiveSmallIntegerField(default=0)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(reward_remainder__lt=100), name="star_remainder_range"
            )
        ]

    def __str__(self) -> str:
        return f"Stars<{self.user_id}>"


class StarGrant(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    provider = models.CharField(max_length=10, choices=Provider.choices)
    reference = models.CharField(max_length=255)
    product = models.CharField(max_length=30)
    subscription_reference = models.CharField(max_length=255, blank=True)
    units = models.PositiveBigIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["provider", "reference"], name="one_verified_star_grant"
            )
        ]

    def __str__(self) -> str:
        return f"StarGrant<{self.pk}>"


class Subscription(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    provider = models.CharField(max_length=10, choices=Provider.choices)
    reference = models.CharField(max_length=255)
    auto_renews = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["provider", "reference"], name="one_subscription_account"
            )
        ]

    def __str__(self) -> str:
        return f"Subscription<{self.user_id}>"


class SubscriptionPeriod(models.Model):
    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE, related_name="periods")
    grant = models.OneToOneField(StarGrant, on_delete=models.CASCADE, related_name="period")
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    bonus_packs_remaining = models.PositiveSmallIntegerField(default=SUBSCRIPTION_BONUS_PACKS)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(ends_at__gt=models.F("starts_at")),
                name="subscription_period_order",
            ),
            models.CheckConstraint(
                condition=models.Q(bonus_packs_remaining__lte=SUBSCRIPTION_BONUS_PACKS),
                name="subscription_bonus_limit",
            ),
        ]
        indexes = [models.Index(fields=["subscription", "starts_at", "ends_at"])]

    def __str__(self) -> str:
        return f"SubscriptionPeriod<{self.pk}>"


class StarEntry(models.Model):
    class Kind(models.TextChoices):
        GRANT = "grant", "Verified payment grant"
        SPEND = "spend", "Pack opening"
        REWARD = "reward", "Creator reward"
        CLOSURE = "closure", "Account closed"
        REFUND = "refund", "Refunded payment"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    kind = models.CharField(max_length=10, choices=Kind.choices)
    units = models.BigIntegerField()
    balance_after = models.BigIntegerField()
    remainder_after = models.PositiveSmallIntegerField(default=0)
    grant = models.ForeignKey(StarGrant, null=True, blank=True, on_delete=models.SET_NULL)
    opening = models.ForeignKey(
        "packs.PackOpening", null=True, blank=True, on_delete=models.SET_NULL
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["user", "created_at"])]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "opening", "kind"],
                condition=models.Q(opening__isnull=False),
                name="one_star_entry_per_opening_kind",
            ),
            models.UniqueConstraint(
                fields=["grant"],
                condition=models.Q(grant__isnull=False, kind="grant"),
                name="one_star_entry_per_grant",
            ),
        ]

    def __str__(self) -> str:
        return f"StarEntry<{self.pk}>"


class StripeCustomer(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    reference = models.CharField(max_length=255, unique=True)

    def __str__(self) -> str:
        return f"StripeCustomer<{self.user_id}>"


class MembershipSettings(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    show_badge = models.BooleanField(default=True)

    def __str__(self) -> str:
        return f"MembershipSettings<{self.user_id}>"


class Checkout(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    request_key = models.UUIDField()
    product = models.CharField(max_length=30)
    price_reference = models.CharField(max_length=255)
    price_cents = models.PositiveIntegerField()
    session_reference = models.CharField(max_length=255, null=True, blank=True, unique=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "request_key"], name="one_checkout_request")
        ]
        indexes = [models.Index(fields=["user", "product", "expires_at"])]

    def __str__(self) -> str:
        return f"Checkout<{self.pk}>"


class StripeEvent(models.Model):
    reference = models.CharField(max_length=255, primary_key=True)
    kind = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"StripeEvent<{self.reference}>"


class BillingReview(models.Model):
    event = models.OneToOneField(StripeEvent, on_delete=models.CASCADE)
    payment_reference = models.CharField(max_length=255)
    reason = models.CharField(max_length=100)
    resolved_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return f"BillingReview<{self.event_id}>"
