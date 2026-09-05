from rest_framework import serializers

from . import storage
from .models import Image


class ImageSerializer(serializers.ModelSerializer):
    url = serializers.CharField(read_only=True)

    class Meta:
        model = Image
        fields = ["id", "kind", "url", "width", "height", "ready"]
        read_only_fields = fields


class CreateUploadSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=Image.Kind.choices)
    content_type = serializers.ChoiceField(choices=list(storage.ALLOWED_TYPES))


class CompleteUploadSerializer(serializers.Serializer):
    width = serializers.IntegerField(min_value=1, max_value=20000)
    height = serializers.IntegerField(min_value=1, max_value=20000)
