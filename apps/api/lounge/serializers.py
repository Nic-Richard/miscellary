from typing import Any

from rest_framework import serializers


class PostWriteSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=120, trim_whitespace=True)
    body = serializers.CharField(max_length=3000, trim_whitespace=True)
    style: Any = serializers.ChoiceField(choices=["plain", "binder"], default="plain")
    card_ids = serializers.ListField(child=serializers.UUIDField(), max_length=6, default=list)
    rules_accepted = serializers.BooleanField()

    def validate(self, attrs):
        if not attrs["rules_accepted"]:
            raise serializers.ValidationError("Agree to the Lounge rules before posting.")
        if len(set(attrs["card_ids"])) != len(attrs["card_ids"]):
            raise serializers.ValidationError("Choose each card only once.")
        return attrs


class ReplyWriteSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=1000, trim_whitespace=True)
    parent_id = serializers.UUIDField(required=False, allow_null=True)
