from rest_framework import serializers

from cards.rendering import render_url
from cards.serializers import CardSerializer, CardSetSerializer, CreatorSerializer
from packs.serializers import OwnedCardSerializer

from .models import COMMENT_MAX, SHOWCASE_SLOTS, Comment, Notification, Report, ShowcaseSlot


class ShowcaseSlotSerializer(serializers.ModelSerializer):
    position = serializers.SerializerMethodField()
    owned_card = OwnedCardSerializer(read_only=True)

    class Meta:
        model = ShowcaseSlot
        fields = ["position", "owned_card"]

    def get_position(self, obj: ShowcaseSlot) -> int:
        return obj.position + 1


class ProfilePageSerializer(serializers.Serializer):
    username = serializers.CharField()
    display_name = serializers.CharField()
    bio = serializers.CharField()
    showcase_title = serializers.CharField()
    binder_colour = serializers.CharField(allow_blank=True)
    avatar_url = serializers.CharField(allow_null=True)
    is_demo = serializers.BooleanField()
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


class PackEntrySerializer(serializers.Serializer):
    card_set = CardSetSerializer()
    free_available = serializers.BooleanField()
    resets_at = serializers.DateTimeField()
    points = serializers.IntegerField()
    pack_cost = serializers.IntegerField()
    owned_count = serializers.IntegerField()
    card_count = serializers.IntegerField()
    duplicate_count = serializers.IntegerField()
    recent_cards = CardSerializer(many=True)
    followed_at = serializers.DateTimeField()


class NotificationSerializer(serializers.ModelSerializer):
    """A notification carries enough to render and link itself without a second
    request: who did it, and the title and slug of what they did it to."""

    actor = CreatorSerializer(read_only=True)
    set_slug = serializers.CharField(source="card_set.slug", default=None, read_only=True)
    set_title = serializers.CharField(source="card_set.title", default=None, read_only=True)
    card_title = serializers.CharField(source="card.title", default=None, read_only=True)
    comment_body = serializers.SerializerMethodField()
    card_image = serializers.SerializerMethodField()
    set_pack_image = serializers.SerializerMethodField()
    read = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id",
            "kind",
            "actor",
            "set_slug",
            "set_title",
            "card_title",
            "comment_body",
            "card_image",
            "set_pack_image",
            "read",
            "created_at",
        ]
        read_only_fields = fields

    def get_card_image(self, obj: Notification) -> str | None:
        card = obj.card
        if card is None or not card.render_front_thumbnail_key:
            return None
        return render_url(card.render_front_thumbnail_key)

    def get_set_pack_image(self, obj: Notification) -> str | None:
        card_set = obj.card_set
        if card_set is None or not card_set.render_pack_key:
            return None
        return render_url(card_set.render_pack_key)

    def get_comment_body(self, obj: Notification) -> str:
        comment = obj.comment
        if comment is None or comment.removed:
            return ""
        return comment.body[:140]

    def get_read(self, obj: Notification) -> bool:
        return obj.read_at is not None
