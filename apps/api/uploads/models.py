import uuid

from django.conf import settings
from django.db import models


class Image(models.Model):
    """An image object in S3 (MinIO locally).

    The browser uploads straight to the bucket with a presigned URL; the API
    only stores the key and metadata. `ready` flips on when the client confirms
    the upload finished and the object actually exists.
    """

    class Kind(models.TextChoices):
        CARD = "card", "Card art"
        COVER = "cover", "Set cover"
        AVATAR = "avatar", "Avatar"
        PACK = "pack", "Pack artwork"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="images"
    )
    kind = models.CharField(max_length=10, choices=Kind.choices)
    key = models.CharField(max_length=255, unique=True)
    content_type = models.CharField(max_length=50)
    size = models.PositiveIntegerField(default=0)
    width = models.PositiveIntegerField(default=0)
    height = models.PositiveIntegerField(default=0)
    ready = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.key

    @property
    def url(self) -> str:
        return f"{settings.MEDIA_PUBLIC_URL.rstrip('/')}/{self.key}"
