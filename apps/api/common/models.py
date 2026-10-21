import uuid

from django.db import models


class ModerationAction(models.Model):
    request_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    target_kind = models.CharField(max_length=20)
    target_id = models.CharField(max_length=80)
    action = models.CharField(max_length=20)
    actor_id = models.CharField(max_length=20)
    actor_name = models.CharField(max_length=100)
    result = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["target_kind", "target_id"])]

    def __str__(self) -> str:
        return f"{self.action}: {self.target_kind} {self.target_id}"
