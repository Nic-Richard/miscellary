from typing import Any, cast

from rest_framework import serializers

from uploads.models import Image
from uploads.serializers import ImageSerializer

from . import packlayers, packtext, templates
from .identity import set_code_problems, suggest_set_code
from .markdown import ISSUE_MESSAGES, description_issues
from .models import CardDefinition, CardSet
from .rarity import RARITIES
from .rendering import (
    CARD_RENDERER_VERSION,
    FACE_SIZE,
    PACK_SIZE_PX,
    THUMBNAIL_SIZE,
    back_render_signature,
    card_render_signature,
    card_spot,
    pack_render_signature,
    render_url,
)


class CreatorSerializer(serializers.Serializer):
    username = serializers.CharField()
    display_name = serializers.CharField(source="profile.display_name")
    avatar_url = serializers.CharField(source="profile.avatar_url", allow_null=True)
    is_demo = serializers.BooleanField()


class CardSerializer(serializers.ModelSerializer):
    image = ImageSerializer(read_only=True)
    like_count = serializers.IntegerField(read_only=True, default=0)
    printed_set_code = serializers.CharField(source="card_set.printed_code", read_only=True)
    render = serializers.SerializerMethodField()

    def get_render(self, obj: CardDefinition):
        if obj.card_set.status == CardSet.Status.DRAFT:
            return None
        signature = card_render_signature(obj)
        back_signature = back_render_signature(obj.card_set)
        # Spot work is masked to its region, so those cards need a mask pair.
        spot = card_spot(obj.template_config, obj.rarity)
        front_ready = (
            obj.render_signature == signature
            and bool(obj.render_front_thumbnail_key)
            and bool(obj.render_front_key)
            and bool(obj.render_flat_thumbnail_key)
            and (not spot or bool(obj.render_mask_thumbnail_key and obj.render_mask_key))
        )
        back_ready = obj.card_set.render_back_signature == back_signature and bool(
            obj.card_set.render_back_key
        )

        def asset(key: str, size: tuple[int, int]):
            if not key:
                return None
            return {"url": render_url(key), "width": size[0], "height": size[1]}

        return {
            "status": "ready" if front_ready and back_ready else "pending",
            "signature": signature,
            "version": CARD_RENDERER_VERSION,
            "thumbnail": asset(obj.render_front_thumbnail_key, THUMBNAIL_SIZE)
            if front_ready
            else None,
            "flat_thumbnail": asset(obj.render_flat_thumbnail_key, THUMBNAIL_SIZE)
            if front_ready
            else None,
            "front": asset(obj.render_front_key, FACE_SIZE) if front_ready else None,
            "spot": spot,
            "mask_thumbnail": asset(obj.render_mask_thumbnail_key, THUMBNAIL_SIZE)
            if front_ready and spot
            else None,
            "mask": asset(obj.render_mask_key, FACE_SIZE) if front_ready and spot else None,
            "back": asset(obj.card_set.render_back_key, FACE_SIZE) if back_ready else None,
        }

    class Meta:
        model = CardDefinition
        fields = [
            "id",
            "title",
            "rarity",
            "description",
            "printed_text",
            "image",
            "template_key",
            "template_version",
            "template_config",
            "position",
            "printed_set_code",
            "set_total",
            "like_count",
            "render",
        ]
        read_only_fields = fields


class CardWriteSerializer(serializers.ModelSerializer):
    image_id = serializers.UUIDField()
    rarity = serializers.ChoiceField(choices=RARITIES)
    template_key = serializers.ChoiceField(choices=list(templates.TEMPLATES_BY_KEY))
    template_config = serializers.DictField(child=serializers.CharField(), required=False)

    class Meta:
        model = CardDefinition
        fields = [
            "image_id",
            "title",
            "rarity",
            "description",
            "printed_text",
            "template_key",
            "template_config",
        ]

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

    def validate_printed_text(self, value: str) -> str:
        # Printed regions take the same small subset the description does, so
        # headings, links, HTML and code are refused here too.
        issues = [issue for issue in description_issues(value) if issue != "too_long"]
        if issues:
            raise serializers.ValidationError([ISSUE_MESSAGES[i] for i in issues])
        return value

    def validate(self, attrs):
        key = attrs.get("template_key") or (self.instance.template_key if self.instance else None)
        config = attrs.get("template_config")
        if config is None:
            config = self.instance.template_config if self.instance else {}
        rarity = attrs.get("rarity") or (self.instance.rarity if self.instance else None)
        title = attrs.get("title") or (self.instance.title if self.instance else "")
        printed_text = attrs.get("printed_text")
        if printed_text is None:
            printed_text = self.instance.printed_text if self.instance else ""
        text_rules = templates.TEMPLATES_BY_KEY[key]["text"]
        if len(title) > text_rules["title"]["max_length"]:
            title_limit = text_rules["title"]["max_length"]
            raise serializers.ValidationError(
                {"title": [f"This template fits titles up to {title_limit} characters."]}
            )
        printed_rules = text_rules["printed"]
        if printed_rules is None and printed_text:
            raise serializers.ValidationError(
                {"printed_text": ["This template has no separate printed text area."]}
            )
        if printed_rules is not None and len(printed_text) > printed_rules["max_length"]:
            raise serializers.ValidationError(
                {
                    "printed_text": [
                        f"This area fits up to {printed_rules['max_length']} characters."
                    ]
                }
            )
        gated = templates.template_problems(key, rarity)
        if gated:
            raise serializers.ValidationError({"template_key": gated})
        full = {**templates.default_config(key), **templates.current_config(config)}
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
    suggested_set_code = serializers.SerializerMethodField()
    printed_set_code = serializers.SerializerMethodField()
    render_back = serializers.SerializerMethodField()
    render_pack = serializers.SerializerMethodField()

    def get_suggested_set_code(self, obj: CardSet) -> str:
        return suggest_set_code(obj.title)

    def get_printed_set_code(self, obj: CardSet) -> str:
        if obj.set_code_suffix:
            return obj.printed_code
        return obj.set_code or suggest_set_code(obj.title)

    def get_render_pack(self, obj: CardSet):
        """A picture of the wrapper, for lists that cannot afford to draw it."""
        if obj.status == CardSet.Status.DRAFT:
            return None
        signature = pack_render_signature(obj)
        ready = obj.render_pack_signature == signature and bool(obj.render_pack_key)
        return {
            "status": "ready" if ready else "pending",
            "signature": signature,
            "version": CARD_RENDERER_VERSION,
            "image": {
                "url": render_url(obj.render_pack_key),
                "width": PACK_SIZE_PX[0],
                "height": PACK_SIZE_PX[1],
            }
            if ready
            else None,
        }

    def get_render_back(self, obj: CardSet):
        if obj.status == CardSet.Status.DRAFT:
            return None
        signature = back_render_signature(obj)
        ready = obj.render_back_signature == signature and bool(obj.render_back_key)
        return {
            "status": "ready" if ready else "pending",
            "signature": signature,
            "version": CARD_RENDERER_VERSION,
            "image": {
                "url": render_url(obj.render_back_key),
                "width": FACE_SIZE[0],
                "height": FACE_SIZE[1],
            }
            if ready
            else None,
        }

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
            "set_code",
            "suggested_set_code",
            "printed_set_code",
            "status",
            "creator",
            "card_count",
            "like_count",
            "opening_count",
            "liked",
            "render_back",
            "render_pack",
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
            "set_code",
        ]

    def validate_set_code(self, value: str) -> str:
        value = value.strip().upper()
        found = set_code_problems(value)
        if found:
            raise serializers.ValidationError(found)
        return value

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
    text = serializers.DictField()
    unlocks = serializers.CharField(required=False)
    options = serializers.DictField()
