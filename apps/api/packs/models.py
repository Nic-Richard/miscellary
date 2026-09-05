import uuid

from django.conf import settings
from django.db import models

from cards.models import CardDefinition, CardSet


class PackOpening(models.Model):
    class Kind(models.TextChoices):
        FREE = "free", "Daily free pack"
        POINTS = "points", "Bought with set points"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="pack_openings"
    )
    card_set = models.ForeignKey(CardSet, on_delete=models.CASCADE, related_name="pack_openings")
    kind = models.CharField(max_length=10, choices=Kind.choices)
    # UTC date, so the database itself enforces one free pack per set per day.
    opened_on = models.DateField()
    opened_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-opened_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "card_set", "opened_on"],
                condition=models.Q(kind="free"),
                name="one_free_pack_per_set_per_day",
            )
        ]

    def __str__(self) -> str:
        return f"{self.user} opened {self.card_set} ({self.kind})"


class OwnedCard(models.Model):
    """An individually owned copy of a card, created by a pack pull.

    Trading moves these between users. Recycling deletes them.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="owned_cards"
    )
    card = models.ForeignKey(CardDefinition, on_delete=models.PROTECT, related_name="copies")
    pack_opening = models.ForeignKey(
        PackOpening, null=True, blank=True, on_delete=models.SET_NULL, related_name="cards"
    )
    acquired_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-acquired_at"]
        indexes = [models.Index(fields=["owner", "card"])]

    def __str__(self) -> str:
        return f"{self.owner}'s {self.card}"


class SetPoints(models.Model):
    """Points earned by recycling duplicates from one set, spendable only on that set."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="set_points"
    )
    card_set = models.ForeignKey(CardSet, on_delete=models.CASCADE, related_name="points")
    balance = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "card_set"], name="one_balance_per_user_set")
        ]

    def __str__(self) -> str:
        return f"{self.user}: {self.balance} pts in {self.card_set}"
