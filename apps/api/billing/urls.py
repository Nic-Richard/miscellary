from django.urls import path

from .views import (
    CheckoutView,
    CreatorStatsView,
    MembershipView,
    PlayNotificationView,
    PlayPurchaseView,
    PortalView,
    StripeWebhookView,
)

app_name = "billing"

urlpatterns = [
    path("me/membership/", MembershipView.as_view(), name="membership"),
    path("me/creator-stats/", CreatorStatsView.as_view(), name="creator-stats"),
    path("me/billing/checkout/", CheckoutView.as_view(), name="checkout"),
    path("me/billing/portal/", PortalView.as_view(), name="portal"),
    path("billing/stripe/webhook/", StripeWebhookView.as_view(), name="stripe-webhook"),
    path("me/billing/play/", PlayPurchaseView.as_view(), name="play-purchase"),
    path("billing/play/notify/", PlayNotificationView.as_view(), name="play-notify"),
]
