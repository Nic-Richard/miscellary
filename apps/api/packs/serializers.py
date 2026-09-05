from rest_framework import serializers

from cards.serializers import CardSerializer, CardSetSerializer

from .models import OwnedCard, PackOpening


class OwnedCardSerializer(serializers.ModelSerializer):
    card = CardSerializer(read_only=True)
    set_slug = serializers.CharField(source="card.card_set.slug", read_only=True)
    set_title = serializers.CharField(source="card.card_set.title", read_only=True)
    set_mark = serializers.CharField(source="card.card_set.mark", read_only=True)
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
