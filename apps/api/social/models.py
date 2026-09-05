import uuid

from django.conf import settings
from django.db import models

from cards.models import CardDefinition, CardSet
from packs.models import OwnedCard

SHOWCASE_SLOTS = 6
COMMENT_MAX = 1000


class Follow(models.Model):
    follower = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="following"
    )
    following = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="followers"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["follower", "following"], name="follow_once"),
            models.CheckConstraint(
                condition=~models.Q(follower=models.F("following")), name="no_self_follow"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.follower} follows {self.following}"


class Reaction(models.Model):
    """A like on a set or a card. Exactly one target is set."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reactions"
    )
    card_set = models.ForeignKey(
        CardSet, null=True, blank=True, on_delete=models.CASCADE, related_name="reactions"
    )
    card = models.ForeignKey(
        CardDefinition, null=True, blank=True, on_delete=models.CASCADE, related_name="reactions"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "card_set"], name="one_reaction_per_set"),
            models.UniqueConstraint(fields=["user", "card"], name="one_reaction_per_card"),
            models.CheckConstraint(
                condition=(
                    models.Q(card_set__isnull=False, card__isnull=True)
                    | models.Q(card_set__isnull=True, card__isnull=False)
                ),
                name="reaction_has_one_target",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.user} likes {self.card_set or self.card}"


class ShowcaseSlot(models.Model):
    """Cards a user pins to their profile. Only counts while they still own the card."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="showcase"
    )
    position = models.PositiveSmallIntegerField()
    owned_card = models.ForeignKey(OwnedCard, on_delete=models.CASCADE, related_name="+")

    class Meta:
        ordering = ["position"]
        constraints = [
            models.UniqueConstraint(fields=["user", "position"], name="one_card_per_slot"),
            models.UniqueConstraint(fields=["user", "owned_card"], name="card_showcased_once"),
        ]

    def __str__(self) -> str:
        return f"{self.user} slot {self.position}"


class Comment(models.Model):
    """A set comment with one level of replies and soft deletion for parent comments."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    card_set = models.ForeignKey(CardSet, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="comments"
    )
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.CASCADE, related_name="replies"
    )
    body = models.TextField(max_length=COMMENT_MAX)
    created_at = models.DateTimeField(auto_now_add=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [models.Index(fields=["card_set", "created_at"])]

    def __str__(self) -> str:
        return f"{self.author} on {self.card_set}"

    @property
    def removed(self) -> bool:
        return self.deleted_at is not None


class Report(models.Model):
    class Reason(models.TextChoices):
        EXPLICIT = "explicit", "Explicit or adult content"
        REAL_PERSON = "real_person", "Inappropriate use of a real person"
        STOLEN = "stolen", "Stolen photo or content"
        HARASSMENT = "harassment", "Harassment or abuse"
        SPAM = "spam", "Spam"
        OTHER = "other", "Something else"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        RESOLVED = "resolved", "Resolved"
        DISMISSED = "dismissed", "Dismissed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reports_made"
    )
    card_set = models.ForeignKey(
        CardSet, null=True, blank=True, on_delete=models.SET_NULL, related_name="reports"
    )
    card = models.ForeignKey(
        CardDefinition, null=True, blank=True, on_delete=models.SET_NULL, related_name="reports"
    )
    comment = models.ForeignKey(
        "Comment", null=True, blank=True, on_delete=models.SET_NULL, related_name="reports"
    )
    reported_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reports_received",
    )
    reason = models.CharField(max_length=20, choices=Reason.choices)
    details = models.TextField(max_length=1000, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.reason} report by {self.reporter}"
