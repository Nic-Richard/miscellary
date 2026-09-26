from rest_framework import serializers

from . import storage
from .models import Image


class ImageSerializer(serializers.ModelSerializer):
    url = serializers.CharField(read_only=True)
    credit = serializers.SerializerMethodField()

    def get_credit(self, obj: Image) -> dict[str, str] | None:
        """The attribution a licence asks for, in a fixed shape.

        `source_metadata` is a free-form blob, so only the four fields a credit
        line needs are published, and only when there is a name or a link to cite.
        """
        source = obj.source_metadata or {}
        author = str(source.get("author") or "").strip()
        source_url = str(source.get("source_url") or "").strip()
        if not author and not source_url:
            return None
        return {
            "author": author,
            "license": str(source.get("license") or "").strip(),
            "license_url": str(source.get("license_url") or "").strip(),
            "source_url": source_url,
        }

    class Meta:
        model = Image
        fields = ["id", "kind", "url", "width", "height", "ready", "credit"]
        read_only_fields = fields


# Mirrors PHOTO_LICENCES in packages/shared; the label is what a credit line prints.
LICENCES = {
    "own": ("", ""),
    "cc-by": ("CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/"),
    "cc-by-sa": ("CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/"),
    "public-domain": ("Public domain", "https://creativecommons.org/publicdomain/mark/1.0/"),
    "permission": ("Used with permission", ""),
    "other": ("", ""),
}


class CreditSerializer(serializers.Serializer):
    licence = serializers.ChoiceField(choices=list(LICENCES))
    author = serializers.CharField(max_length=120, required=False, allow_blank=True)
    source_url = serializers.URLField(max_length=500, required=False, allow_blank=True)


class CreateUploadSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=Image.Kind.choices)
    content_type = serializers.ChoiceField(choices=list(storage.ALLOWED_TYPES))


class CompleteUploadSerializer(serializers.Serializer):
    width = serializers.IntegerField(min_value=1, max_value=20000)
    height = serializers.IntegerField(min_value=1, max_value=20000)
