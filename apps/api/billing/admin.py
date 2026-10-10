from django.contrib import admin

from .models import BillingReview, Checkout, StarEntry, StripeEvent


class ReadOnlyAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(BillingReview)
class BillingReviewAdmin(ReadOnlyAdmin):
    list_display = ["provider", "event", "payment_reference", "reason", "resolved_at"]
    list_filter = ["provider", "reason", "resolved_at"]
    search_fields = ["payment_reference", "event__reference"]


@admin.register(Checkout)
class CheckoutAdmin(ReadOnlyAdmin):
    list_display = ["id", "user", "product", "completed", "expires_at"]
    list_filter = ["product", "completed"]
    search_fields = ["session_reference", "user__username"]


@admin.register(StarEntry)
class StarEntryAdmin(ReadOnlyAdmin):
    list_display = ["user", "kind", "units", "balance_after", "created_at"]
    list_filter = ["kind"]
    search_fields = ["user__username"]


@admin.register(StripeEvent)
class StripeEventAdmin(ReadOnlyAdmin):
    list_display = ["reference", "kind", "created_at"]
    list_filter = ["kind"]
