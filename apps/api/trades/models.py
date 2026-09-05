import uuid

from django.conf import settings
from django.db import models

from packs.models import OwnedCard


class TradeOffer(models.Model):
    """A Valve-style offer: sender gives some cards, asks for some of the recipient's.

    Offers are immutable. Changing anything means countering, which creates a
    new offer in the other direction and closes this one.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        REJECTED = "rejected", "Rejected"
        CANCELLED = "cancelled", "Cancelled"
        COUNTERED = "countered", "Countered"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_offers"
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="received_offers"
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    message = models.CharField(max_length=200, blank=True)
    counter_of = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="counters"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.sender} -> {self.recipient} ({self.status})"

    @property
    def is_pending(self) -> bool:
        return self.status == self.Status.PENDING


class TradeOfferItem(models.Model):
    class Side(models.TextChoices):
        GIVE = "give", "Sender gives"
        WANT = "want", "Sender wants"

    offer = models.ForeignKey(TradeOffer, on_delete=models.CASCADE, related_name="items")
    owned_card = models.ForeignKey(OwnedCard, on_delete=models.CASCADE, related_name="trade_items")
    side = models.CharField(max_length=4, choices=Side.choices)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["offer", "owned_card"], name="card_once_per_offer")
        ]

    def __str__(self) -> str:
        return f"{self.side}: {self.owned_card}"
