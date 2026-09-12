from rest_framework import serializers

from . import storage
from .models import Image


class ImageSerializer(serializers.ModelSerializer):
    url = serializers.CharField(read_only=True)
    credit = serializers.SerializerMethodField()

    def get_credit(self, obj: Image) -> dict[str, str] | None:
        """The attribution a licence asks for, in a fixed shape.

        `source_metadata` is a free-form blob, so only the four fields a credit
        line needs are published, and only when there is an author to name.
        """
        source = obj.source_metadata or {}
        author = str(source.get("author") or "").strip()
        if not author:
            return None
        return {
            "author": author,
            "license": str(source.get("license") or "").strip(),
            "license_url": str(source.get("license_url") or "").strip(),
            "source_url": str(source.get("source_url") or "").strip(),
        }

    class Meta:
        model = Image
        fields = ["id", "kind", "url", "width", "height", "ready", "credit"]
        read_only_fields = fields


class CreateUploadSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=Image.Kind.choices)
    content_type = serializers.ChoiceField(choices=list(storage.ALLOWED_TYPES))


class CompleteUploadSerializer(serializers.Serializer):
    width = serializers.IntegerField(min_value=1, max_value=20000)
    height = serializers.IntegerField(min_value=1, max_value=20000)
