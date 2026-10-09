from rest_framework import serializers

from cards.serializers import CardSerializer, CardSetSerializer

from .models import OwnedCard, PackOpening


class OpenPackRequestSerializer(serializers.Serializer):
    payment = serializers.ChoiceField(choices=["free", "points", "stars", "bonus"], required=False)
    use_points = serializers.BooleanField(required=False)
    request_key = serializers.UUIDField(required=False)
    max_stars_units = serializers.IntegerField(min_value=0, max_value=50000, required=False)

    def validate(self, attrs):
        if "payment" in attrs and "use_points" in attrs:
            raise serializers.ValidationError("Choose one pack payment method.")
        payment = attrs.get("payment", "points" if attrs.get("use_points") else "free")
        attrs["payment"] = payment
        if payment in {"stars", "bonus"} and "request_key" not in attrs:
            raise serializers.ValidationError(
                {"request_key": "A purchase request key is required."}
            )
        if payment == "stars" and "max_stars_units" not in attrs:
            raise serializers.ValidationError(
                {"max_stars_units": "Confirm the maximum Stars to spend."}
            )
        return attrs


class OwnedCardSerializer(serializers.ModelSerializer):
    card = CardSerializer(read_only=True)
    set_slug = serializers.CharField(source="card.card_set.slug", read_only=True)
    set_title = serializers.CharField(source="card.card_set.title", read_only=True)
    set_mark = serializers.CharField(source="card.card_set.mark", read_only=True)
    set_pack_colour = serializers.CharField(source="card.card_set.pack_colour", read_only=True)
    # How many copies the owner holds of this card, so duplicates can be flagged.
    copies = serializers.IntegerField(read_only=True)
    held = serializers.BooleanField(read_only=True)

    class Meta:
        model = OwnedCard
        fields = [
            "id",
            "card",
            "set_slug",
            "set_title",
            "set_mark",
            "set_pack_colour",
            "copies",
            "held",
            "acquired_at",
        ]
        read_only_fields = fields


class PackOpeningSerializer(serializers.ModelSerializer):
    cards = OwnedCardSerializer(many=True, read_only=True)
    card_set = CardSetSerializer(read_only=True)

    class Meta:
        model = PackOpening
        fields = ["id", "kind", "card_set", "cards", "opened_at"]
        read_only_fields = fields
