from rest_framework import serializers

from cards.serializers import CardSetSerializer, CreatorSerializer
from packs.serializers import OwnedCardSerializer

from .models import COMMENT_MAX, SHOWCASE_SLOTS, Comment, Report, ShowcaseSlot


class ShowcaseSlotSerializer(serializers.ModelSerializer):
    owned_card = OwnedCardSerializer(read_only=True)

    class Meta:
        model = ShowcaseSlot
        fields = ["position", "owned_card"]


class ProfilePageSerializer(serializers.Serializer):
    username = serializers.CharField()
    display_name = serializers.CharField()
    bio = serializers.CharField()
    showcase_title = serializers.CharField()
    avatar_url = serializers.CharField(allow_null=True)
    created_at = serializers.DateTimeField()
    follower_count = serializers.IntegerField()
    following_count = serializers.IntegerField()
    set_count = serializers.IntegerField()
    card_count = serializers.IntegerField()
    is_following = serializers.BooleanField()
    is_me = serializers.BooleanField()
    showcase = ShowcaseSlotSerializer(many=True)
    sets = CardSetSerializer(many=True)


class ShowcaseWriteSerializer(serializers.Serializer):
    # Full replacement: positions 0..5, each with an owned card id.
    slots = serializers.ListField(
        child=serializers.DictField(child=serializers.CharField()), max_length=SHOWCASE_SLOTS
    )


class CommentSerializer(serializers.ModelSerializer):
    """One comment. A removed one keeps its place in the thread but loses its
    body and its author, so a reply below it still has something to hang from."""

    author = serializers.SerializerMethodField()
    body = serializers.SerializerMethodField()
    removed = serializers.BooleanField(read_only=True)
    replies = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()
    is_creator = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = [
            "id",
            "author",
            "body",
            "removed",
            "is_creator",
            "created_at",
            "can_delete",
            "replies",
        ]

    def get_author(self, obj: Comment):
        if obj.removed:
            return None
        return CreatorSerializer(obj.author).data

    def get_body(self, obj: Comment) -> str:
        return "" if obj.removed else obj.body

    def get_is_creator(self, obj: Comment) -> bool:
        return not obj.removed and obj.author_id == self.context.get("creator_id")

    def get_can_delete(self, obj: Comment) -> bool:
        user = self.context.get("viewer")
        if obj.removed or user is None or not user.is_authenticated:
            return False
        return obj.author_id == user.pk or self.context.get("creator_id") == user.pk

    def get_replies(self, obj: Comment):
        replies = self.context.get("replies", {}).get(obj.pk, [])
        return CommentSerializer(replies, many=True, context=self.context).data


class CommentWriteSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=COMMENT_MAX, trim_whitespace=True)
    parent_id = serializers.UUIDField(required=False, allow_null=True)


class ReportWriteSerializer(serializers.Serializer):
    set_slug = serializers.CharField(required=False)
    card_id = serializers.UUIDField(required=False)
    comment_id = serializers.UUIDField(required=False)
    username = serializers.CharField(required=False)
    reason = serializers.ChoiceField(choices=Report.Reason.choices)
    details = serializers.CharField(required=False, allow_blank=True, default="", max_length=1000)

    def validate(self, attrs):
        targets = [k for k in ("set_slug", "card_id", "comment_id", "username") if attrs.get(k)]
        if len(targets) != 1:
            raise serializers.ValidationError(
                "Report exactly one thing: a set, a card, a comment, or a user."
            )
        return attrs
