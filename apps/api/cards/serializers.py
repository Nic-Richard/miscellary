from typing import Any, cast

from rest_framework import serializers

from uploads.models import Image
from uploads.serializers import ImageSerializer

from . import packlayers, packtext, templates
from .markdown import ISSUE_MESSAGES, description_issues
from .models import CardDefinition, CardSet
from .rarity import RARITIES


class CreatorSerializer(serializers.Serializer):
    username = serializers.CharField()
    display_name = serializers.CharField(source="profile.display_name")
    avatar_url = serializers.CharField(source="profile.avatar_url", allow_null=True)


class CardSerializer(serializers.ModelSerializer):
    image = ImageSerializer(read_only=True)
    like_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = CardDefinition
        fields = [
            "id",
            "title",
            "rarity",
            "description",
            "image",
            "template_key",
            "template_version",
            "template_config",
            "position",
            "like_count",
        ]
        read_only_fields = fields


class CardWriteSerializer(serializers.ModelSerializer):
    image_id = serializers.UUIDField()
    rarity = serializers.ChoiceField(choices=RARITIES)
    template_key = serializers.ChoiceField(choices=list(templates.TEMPLATES_BY_KEY))
    template_config = serializers.DictField(child=serializers.CharField(), required=False)

    class Meta:
        model = CardDefinition
        fields = ["image_id", "title", "rarity", "description", "template_key", "template_config"]

    def validate_image_id(self, value):
        image = Image.objects.filter(
            id=value, owner=self.context["request"].user, ready=True, kind=Image.Kind.CARD
        ).first()
        if image is None:
            raise serializers.ValidationError("Upload a card image first.")
        return image.id

    def validate_description(self, value: str) -> str:
        issues = description_issues(value)
        if issues:
            raise serializers.ValidationError([ISSUE_MESSAGES[i] for i in issues])
        return value

    def validate(self, attrs):
        key = attrs.get("template_key") or (self.instance.template_key if self.instance else None)
        config = attrs.get("template_config")
        if config is None:
            config = self.instance.template_config if self.instance else {}
        rarity = attrs.get("rarity") or (self.instance.rarity if self.instance else None)
        gated = templates.template_problems(key, rarity)
        if gated:
            raise serializers.ValidationError({"template_key": gated})
        # Freeze a complete config even when the client sends partial values.
        full = {**templates.default_config(key), **config}
        problems = templates.config_problems(key, full, rarity)
        if problems:
            raise serializers.ValidationError({"template_config": problems})
        attrs["template_config"] = full
        attrs["template_version"] = templates.TEMPLATES_BY_KEY[key]["version"]
        return attrs


class CardSetSerializer(serializers.ModelSerializer):
    creator = CreatorSerializer(read_only=True)
    cover = ImageSerializer(read_only=True)
    pack_layers = serializers.SerializerMethodField()
    card_count = serializers.IntegerField(read_only=True)
    like_count = serializers.IntegerField(read_only=True, default=0)
    opening_count = serializers.IntegerField(read_only=True, default=0)
    liked = serializers.BooleanField(read_only=True, default=False)

    def get_pack_layers(self, obj) -> list[dict]:
        """The stored stack with each image's url and pixel size filled in.

        Layers name an image by id, so a client needs the url resolved, and the
        dimensions so it can work out whether a layer is big enough to cover the
        wrapper. The lookups are cached on the serializer context, which a list
        shares across its items, so a set with no artwork costs nothing and a
        repeated image is fetched once.
        """
        layers = obj.pack_layers or []
        if not layers:
            return []
        context = cast(dict[str, Any], self.context)
        cache = context.setdefault("pack_layer_images", {})
        wanted = {layer["image_id"] for layer in layers if layer.get("image_id")}
        missing = wanted - cache.keys()
        if missing:
            for image in Image.objects.filter(id__in=missing):
                cache[str(image.id)] = (image.url, image.width, image.height)
        out = []
        for layer in layers:
            url, width, height = cache.get(layer.get("image_id", ""), ("", 0, 0))
            out.append({**layer, "url": url, "width": width, "height": height})
        return out

    class Meta:
        model = CardSet
        fields = [
            "id",
            "slug",
            "title",
            "description",
            "cover",
            "mark",
            "pack_colour",
            "pack_finish",
            "pack_layers",
            "binder_colour",
            "emblem_layout",
            "emblem_shape",
            "emblem_style",
            "emblem_text",
            "emblem_type_scale",
            "mark_scale",
            "pack_subtitle",
            "pack_text",
            "pack_size",
            "status",
            "creator",
            "card_count",
            "like_count",
            "opening_count",
            "liked",
            "created_at",
            "published_at",
        ]
        read_only_fields = fields


class CardSetDetailSerializer(CardSetSerializer):
    cards = CardSerializer(many=True, read_only=True)

    class Meta(CardSetSerializer.Meta):
        fields = CardSetSerializer.Meta.fields + ["cards"]


class CardSetWriteSerializer(serializers.ModelSerializer):
    cover_id = serializers.UUIDField(required=False, allow_null=True)

    class Meta:
        model = CardSet
        fields = [
            "title",
            "description",
            "cover_id",
            "mark",
            "pack_colour",
            "pack_finish",
            "pack_layers",
            "binder_colour",
            "emblem_layout",
            "emblem_shape",
            "emblem_style",
            "emblem_text",
            "emblem_type_scale",
            "mark_scale",
            "pack_subtitle",
            "pack_text",
            "pack_size",
        ]

    def validate_cover_id(self, value):
        if value is None:
            return None
        exists = Image.objects.filter(
            id=value, owner=self.context["request"].user, ready=True, kind=Image.Kind.COVER
        ).exists()
        if not exists:
            raise serializers.ValidationError("Upload a cover image first.")
        return value

    def validate_pack_text(self, value):
        found = packtext.problems(value)
        if found:
            raise serializers.ValidationError(found)
        return packtext.normalised(value)

    def validate_pack_layers(self, value):
        found = packlayers.problems(value)
        if found:
            raise serializers.ValidationError(found)
        layers = packlayers.normalised(value)
        # Ownership is checked here rather than in packlayers, because this is
        # the only place that knows who is asking.
        wanted = set(packlayers.image_ids(layers))
        if wanted:
            owned = Image.objects.filter(
                id__in=wanted,
                owner=self.context["request"].user,
                ready=True,
                kind=Image.Kind.PACK,
            ).values_list("id", flat=True)
            if len(set(map(str, owned))) != len(wanted):
                raise serializers.ValidationError("Upload pack artwork first.")
        return layers

    def validate_description(self, value: str) -> str:
        issues = description_issues(value)
        if issues:
            raise serializers.ValidationError([ISSUE_MESSAGES[i] for i in issues])
        return value


class TemplateSerializer(serializers.Serializer):
    key = serializers.CharField()
    version = serializers.IntegerField()
    name = serializers.CharField()
    description = serializers.CharField()
    unlocks = serializers.CharField(required=False)
    options = serializers.DictField()
