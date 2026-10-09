import uuid

from django.conf import settings
from django.db import models


class Post(models.Model):
    class Style(models.TextChoices):
        PLAIN = "plain", "Plain"
        BINDER = "binder", "Binder"
        DISPLAY = "display", "Display"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    title = models.CharField(max_length=120)
    body = models.TextField(max_length=3000)
    style = models.CharField(max_length=10, choices=Style.choices, default=Style.PLAIN)
    created_at = models.DateTimeField(auto_now_add=True)
    active_at = models.DateTimeField(auto_now_add=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["deleted_at", "created_at"]),
            models.Index(fields=["deleted_at", "active_at"]),
        ]

    def __str__(self) -> str:
        return self.title


class Attachment(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="attachments")
    owned_card = models.ForeignKey("packs.OwnedCard", null=True, on_delete=models.SET_NULL)
    position = models.PositiveSmallIntegerField()

    class Meta:
        ordering = ["position"]
        constraints = [
            models.UniqueConstraint(
                fields=["post", "position"], name="one_lounge_attachment_position"
            )
        ]

    def __str__(self) -> str:
        return f"Attachment<{self.post_id}:{self.position}>"


class Reply(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="replies")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.CASCADE, related_name="children"
    )
    body = models.TextField(max_length=1000)
    created_at = models.DateTimeField(auto_now_add=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["created_at", "id"]
        indexes = [models.Index(fields=["post", "parent", "created_at"])]

    def __str__(self) -> str:
        return f"Reply<{self.pk}>"


class Vote(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    post = models.ForeignKey(
        Post, null=True, blank=True, on_delete=models.CASCADE, related_name="votes"
    )
    reply = models.ForeignKey(
        Reply, null=True, blank=True, on_delete=models.CASCADE, related_name="votes"
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "post"], name="one_lounge_post_vote"),
            models.UniqueConstraint(fields=["user", "reply"], name="one_lounge_reply_vote"),
            models.CheckConstraint(
                condition=models.Q(post__isnull=False, reply__isnull=True)
                | models.Q(post__isnull=True, reply__isnull=False),
                name="lounge_vote_one_target",
            ),
        ]

    def __str__(self) -> str:
        return f"Vote<{self.pk}>"


class Block(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="lounge_blocks"
    )
    blocked = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="lounge_blocked_by"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "blocked"], name="one_lounge_block"),
            models.CheckConstraint(
                condition=~models.Q(user=models.F("blocked")), name="no_lounge_self_block"
            ),
        ]

    def __str__(self) -> str:
        return f"Block<{self.user_id}:{self.blocked_id}>"
