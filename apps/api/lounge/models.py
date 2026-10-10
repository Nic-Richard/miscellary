import uuid

from django.conf import settings
from django.db import models


class Post(models.Model):
    class Style(models.TextChoices):
        PLAIN = "plain", "Plain"
        BINDER = "binder", "Binder"
        DISPLAY = "display", "Display"

    class Topic(models.TextChoices):
        SHOW = "show", "Show and tell"
        TRADING = "trading", "Trading"
        MAKING = "making", "Making sets"
        QUESTIONS = "questions", "Questions"
        OTHER = "other", "Anything else"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    title = models.CharField(max_length=120)
    body = models.TextField(max_length=3000)
    style = models.CharField(max_length=10, choices=Style.choices, default=Style.PLAIN)
    topic = models.CharField(max_length=12, choices=Topic.choices, default=Topic.OTHER)
    created_at = models.DateTimeField(auto_now_add=True)
    active_at = models.DateTimeField(auto_now_add=True)
    edited_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    # Supporters can keep posts as drafts; drafts never appear in the feed.
    draft = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["deleted_at", "created_at"]),
            models.Index(fields=["deleted_at", "active_at"]),
            models.Index(fields=["topic", "deleted_at", "active_at"]),
        ]

    def __str__(self) -> str:
        return self.title


class Attachment(models.Model):
    post = models.ForeignKey(
        Post, null=True, blank=True, on_delete=models.CASCADE, related_name="attachments"
    )
    reply = models.ForeignKey(
        "Reply", null=True, blank=True, on_delete=models.CASCADE, related_name="attachments"
    )
    owned_card = models.ForeignKey("packs.OwnedCard", null=True, on_delete=models.SET_NULL)
    position = models.PositiveSmallIntegerField()

    class Meta:
        ordering = ["position"]
        constraints = [
            models.UniqueConstraint(
                fields=["post", "position"], name="one_lounge_attachment_position"
            ),
            models.UniqueConstraint(
                fields=["reply", "position"], name="one_lounge_reply_attachment_position"
            ),
            models.CheckConstraint(
                condition=models.Q(post__isnull=False, reply__isnull=True)
                | models.Q(post__isnull=True, reply__isnull=False),
                name="lounge_attachment_one_target",
            ),
        ]

    def __str__(self) -> str:
        return f"Attachment<{self.post_id or self.reply_id}:{self.position}>"


class Reply(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="replies")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.CASCADE, related_name="children"
    )
    body = models.TextField(max_length=1000)
    created_at = models.DateTimeField(auto_now_add=True)
    edited_at = models.DateTimeField(null=True, blank=True)
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
    # Up (1) or down (-1); a post's score is the sum.
    value = models.SmallIntegerField(default=1)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "post"], name="one_lounge_post_vote"),
            models.UniqueConstraint(fields=["user", "reply"], name="one_lounge_reply_vote"),
            models.CheckConstraint(
                condition=models.Q(post__isnull=False, reply__isnull=True)
                | models.Q(post__isnull=True, reply__isnull=False),
                name="lounge_vote_one_target",
            ),
            models.CheckConstraint(
                condition=models.Q(value__in=[1, -1]), name="lounge_vote_up_or_down"
            ),
        ]

    def __str__(self) -> str:
        return f"Vote<{self.pk}>"


class SavedFolder(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    name = models.CharField(max_length=40)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["user", "name"], name="one_lounge_folder_name")
        ]

    def __str__(self) -> str:
        return self.name


class SavedPost(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="saves")
    folder = models.ForeignKey(SavedFolder, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["user", "post"], name="one_lounge_save")]

    def __str__(self) -> str:
        return f"SavedPost<{self.user_id}:{self.post_id}>"


class PostRead(models.Model):
    """When someone last opened a discussion, so the list can mark new replies."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="reads")
    read_at = models.DateTimeField()

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "post"], name="one_lounge_read")]

    def __str__(self) -> str:
        return f"PostRead<{self.user_id}:{self.post_id}>"
