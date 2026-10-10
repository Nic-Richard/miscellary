from rest_framework import serializers

from common.monetization import CREDIT_BUNDLES


class CheckoutSerializer(serializers.Serializer):
    product = serializers.ChoiceField(choices=[*CREDIT_BUNDLES, "subscription"])
    request_key = serializers.UUIDField()


class MembershipSettingsSerializer(serializers.Serializer):
    show_badge = serializers.BooleanField()


class PlayPurchaseSerializer(serializers.Serializer):
    product = serializers.ChoiceField(choices=[*CREDIT_BUNDLES, "subscription"])
    purchase_token = serializers.CharField(max_length=255)
