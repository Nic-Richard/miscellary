from typing import Any

from rest_framework import serializers

from .data import BINDER_CARDS, SUPPORTER_REPLY_CARDS
from .models import Post


def _unique(card_ids: list) -> list:
    if len(set(card_ids)) != len(card_ids):
        raise serializers.ValidationError("Choose each card only once.")
    return card_ids


class PostWriteSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=120, trim_whitespace=True)
    body = serializers.CharField(max_length=3000, trim_whitespace=True)
    style: Any = serializers.ChoiceField(choices=["plain", "binder"], default="plain")
    topic: Any = serializers.ChoiceField(choices=Post.Topic.values, default=Post.Topic.OTHER)
    card_ids = serializers.ListField(
        child=serializers.UUIDField(), max_length=BINDER_CARDS, default=list
    )
    draft = serializers.BooleanField(default=False)
    rules_accepted = serializers.BooleanField()

    def validate_card_ids(self, value):
        return _unique(value)

    def validate(self, attrs):
        if not attrs["rules_accepted"]:
            raise serializers.ValidationError("Agree to the Lounge rules before posting.")
        return attrs


class PostEditSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=120, trim_whitespace=True, required=False)
    body = serializers.CharField(max_length=3000, trim_whitespace=True, required=False)
    topic: Any = serializers.ChoiceField(choices=Post.Topic.values, required=False)
    publish = serializers.BooleanField(default=False)


class ReplyWriteSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=1000, trim_whitespace=True)
    parent_id = serializers.UUIDField(required=False, allow_null=True)
    card_ids = serializers.ListField(
        child=serializers.UUIDField(), max_length=SUPPORTER_REPLY_CARDS, default=list
    )

    def validate_card_ids(self, value):
        return _unique(value)


class ReplyEditSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=1000, trim_whitespace=True)


class VoteSerializer(serializers.Serializer):
    value = serializers.ChoiceField(choices=[1, -1], default=1)


class SaveSerializer(serializers.Serializer):
    folder_id = serializers.IntegerField(required=False, allow_null=True)


class FolderSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=40, trim_whitespace=True)
