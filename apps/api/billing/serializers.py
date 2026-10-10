from rest_framework import serializers

from common.monetization import CREDIT_BUNDLES

from .models import MembershipSettings


class CheckoutSerializer(serializers.Serializer):
    product = serializers.ChoiceField(choices=[*CREDIT_BUNDLES, "subscription"])
    request_key = serializers.UUIDField()


class MembershipSettingsSerializer(serializers.Serializer):
    show_badge = serializers.BooleanField(required=False)
    badge_colour = serializers.ChoiceField(
        choices=MembershipSettings.BadgeColour.choices, required=False
    )
    badge_finish = serializers.ChoiceField(
        choices=MembershipSettings.BadgeFinish.choices, required=False
    )


class PlayPurchaseSerializer(serializers.Serializer):
    product = serializers.ChoiceField(choices=[*CREDIT_BUNDLES, "subscription"])
    purchase_token = serializers.CharField(max_length=255)
