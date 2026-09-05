from rest_framework import serializers

from cards.serializers import CreatorSerializer
from packs.serializers import OwnedCardSerializer

from .models import TradeOffer, TradeOfferItem


class TradeItemSerializer(serializers.ModelSerializer):
    owned_card = OwnedCardSerializer(read_only=True)

    class Meta:
        model = TradeOfferItem
        fields = ["owned_card", "side"]


class TradeOfferSerializer(serializers.ModelSerializer):
    sender = CreatorSerializer(read_only=True)
    recipient = CreatorSerializer(read_only=True)
    give = serializers.SerializerMethodField()
    want = serializers.SerializerMethodField()

    class Meta:
        model = TradeOffer
        fields = [
            "id",
            "sender",
            "recipient",
            "status",
            "message",
            "counter_of",
            "give",
            "want",
            "created_at",
            "resolved_at",
        ]
        read_only_fields = fields

    def _side(self, offer, side):
        items = [i for i in offer.items.all() if i.side == side]
        return OwnedCardSerializer([i.owned_card for i in items], many=True).data

    def get_give(self, offer):
        return self._side(offer, "give")

    def get_want(self, offer):
        return self._side(offer, "want")


class OfferWriteSerializer(serializers.Serializer):
    recipient = serializers.CharField(required=False)
    give = serializers.ListField(child=serializers.UUIDField(), required=False, default=list)
    want = serializers.ListField(child=serializers.UUIDField(), required=False, default=list)
    message = serializers.CharField(required=False, allow_blank=True, default="", max_length=200)
