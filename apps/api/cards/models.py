import secrets
import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from uploads.models import Image

from .identity import (
    EMBLEM_LAYOUT_CHOICES,
    EMBLEM_SHAPE_CHOICES,
    EMBLEM_STYLE_CHOICES,
    EMBLEM_TEXT_CHOICES,
    MARK_CHOICES,
    PACK_COLOUR_CHOICES,
    PACK_FINISH_CHOICES,
    PACK_SIZE_DEFAULT,
    PACK_SIZE_MAX,
    PACK_SIZE_MIN,
    PACK_SUBTITLE_MAX_LENGTH,
    SCALE_MAX,
    SCALE_MIN,
)
from .packlayers import default_stack
from .rarity import RARITY_CHOICES


class PublishedCardError(ValidationError):
    """Raised when anything tries to change a card in a published set."""


class CardSet(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        DELETED = "deleted", "Deleted by creator"
        REMOVED = "removed", "Removed by platform"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="card_sets"
    )
    title = models.CharField(max_length=80)
    slug = models.SlugField(max_length=60, unique=True, blank=True)
    description = models.TextField(max_length=600, blank=True)
    cover = models.ForeignKey(
        Image, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    # Blank marks derive from the slug for a stable default.
    mark = models.CharField(max_length=20, choices=MARK_CHOICES, blank=True)
    pack_colour = models.CharField(max_length=20, choices=PACK_COLOUR_CHOICES, blank=True)
    pack_finish = models.CharField(max_length=20, choices=PACK_FINISH_CHOICES, blank=True)
    # Ordered pack-front layers; serializers enforce image ownership.
    pack_layers = models.JSONField(default=default_stack, blank=True)
    emblem_layout = models.CharField(max_length=20, choices=EMBLEM_LAYOUT_CHOICES, blank=True)
    pack_subtitle = models.CharField(max_length=PACK_SUBTITLE_MAX_LENGTH, blank=True)
    # Free text layer shape is validated in cards/packtext.py.
    pack_text = models.JSONField(default=list, blank=True)
    emblem_shape = models.CharField(max_length=20, choices=EMBLEM_SHAPE_CHOICES, blank=True)
    emblem_style = models.CharField(max_length=20, choices=EMBLEM_STYLE_CHOICES, blank=True)
    emblem_text = models.CharField(max_length=20, choices=EMBLEM_TEXT_CHOICES, blank=True)
    # Type scale is independent of the layer's overall emblem scale.
    emblem_type_scale = models.PositiveSmallIntegerField(
        default=100, validators=[MinValueValidator(SCALE_MIN), MaxValueValidator(SCALE_MAX)]
    )
    mark_scale = models.PositiveSmallIntegerField(
        default=100, validators=[MinValueValidator(SCALE_MIN), MaxValueValidator(SCALE_MAX)]
    )
    pack_size = models.PositiveSmallIntegerField(
        default=PACK_SIZE_DEFAULT,
        validators=[MinValueValidator(PACK_SIZE_MIN), MaxValueValidator(PACK_SIZE_MAX)],
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    created_at = models.DateTimeField(auto_now_add=True)
    published_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = f"{slugify(self.title)[:48] or 'set'}-{secrets.token_hex(3)}"
        super().save(*args, **kwargs)

    @property
    def is_draft(self) -> bool:
        return self.status == self.Status.DRAFT

    @property
    def is_published(self) -> bool:
        return self.status == self.Status.PUBLISHED

    def soft_delete(self, removed_by_platform: bool = False) -> None:
        self.status = self.Status.REMOVED if removed_by_platform else self.Status.DELETED
        self.deleted_at = timezone.now()
        self.save(update_fields=["status", "deleted_at"])


class CardDefinition(models.Model):
    """The source card inside a set. Owned copies are stored separately.

    Once the set is published the fields in FROZEN_FIELDS can't change: save()
    and delete() refuse, regardless of which view or script is calling.
    """

    FROZEN_FIELDS = (
        "image_id",
        "title",
        "rarity",
        "description",
        "template_key",
        "template_version",
        "template_config",
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    card_set = models.ForeignKey(CardSet, on_delete=models.CASCADE, related_name="cards")
    image = models.ForeignKey(Image, on_delete=models.PROTECT, related_name="+")
    title = models.CharField(max_length=60)
    rarity = models.CharField(max_length=10, choices=RARITY_CHOICES)
    description = models.TextField(max_length=600, blank=True)
    # Snapshot of the template this card was designed with. Never updated after publish.
    template_key = models.CharField(max_length=30)
    template_version = models.PositiveSmallIntegerField()
    template_config = models.JSONField(default=dict, blank=True)
    position = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["position", "created_at"]

    def __str__(self) -> str:
        return f"{self.title} ({self.rarity})"

    def save(self, *args, **kwargs):
        if self._state.adding:
            if self._is_locked():
                raise PublishedCardError("Cards can't be added to a published set.")
        elif self._is_locked():
            current = CardDefinition.objects.values(*self.FROZEN_FIELDS).get(pk=self.pk)
            changed = [f for f in self.FROZEN_FIELDS if getattr(self, f) != current[f]]
            if changed:
                raise PublishedCardError(
                    f"Published cards can't be changed ({', '.join(changed)})."
                )
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self._is_locked():
            raise PublishedCardError("Published cards can't be deleted.")
        return super().delete(*args, **kwargs)

    def _is_locked(self) -> bool:
        return (
            CardSet.objects.filter(id=self.card_set_id)
            .exclude(status=CardSet.Status.DRAFT)
            .exists()
        )
