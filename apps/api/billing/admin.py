from django import forms
from django.contrib import admin
from django.core.exceptions import ValidationError
from django.db.models import Q
from django.utils import timezone

from .grants import grant_supporter, grant_tickets, revoke_supporter
from .models import (
    BillingReview,
    Checkout,
    ComplimentarySupporter,
    StarEntry,
    StripeEvent,
    TicketGrant,
)


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


class GrantForm(forms.ModelForm):
    def clean_reason(self):
        reason = self.cleaned_data["reason"].strip()
        if not reason:
            raise ValidationError("A reason is required.")
        return reason

    def clean_user(self):
        user = self.cleaned_data["user"]
        if not user.is_active:
            raise ValidationError("This account is closed.")
        return user


class TicketGrantForm(GrantForm):
    class Meta:
        model = TicketGrant
        fields = ["id", "user", "tickets", "reason"]
        labels = {"id": "Grant reference"}
        help_texts = {"id": "Keep this reference when retrying the same grant."}

    def clean_tickets(self):
        tickets = self.cleaned_data["tickets"]
        if not 1 <= tickets <= 1_000_000:
            raise ValidationError("Grant between 1 and 1,000,000 whole tickets.")
        return tickets


class SupporterGrantForm(GrantForm):
    class Meta:
        model = ComplimentarySupporter
        fields = ["user", "reason", "expires_at"]

    def clean(self):
        data = super().clean()
        if self.instance._state.adding:
            now = timezone.now()
            expires = data.get("expires_at")
            if expires and expires <= now:
                self.add_error("expires_at", "Choose an expiry in the future, or leave it empty.")
            user = data.get("user")
            if (
                user
                and ComplimentarySupporter.objects.filter(user=user, revoked_at__isnull=True)
                .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))
                .exists()
            ):
                self.add_error("user", "This account already has complimentary Supporter access.")
        return data


class GrantAdmin(admin.ModelAdmin):
    raw_id_fields = ["user"]
    search_fields = ["user__username", "user__email", "reason"]

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(TicketGrant)
class TicketGrantAdmin(GrantAdmin):
    form = TicketGrantForm
    list_display = ["user", "tickets", "reason", "granted_by", "created_at"]

    def get_fields(self, request, obj=None):
        if obj:
            return ["id", "user", "tickets", "reason", "granted_by", "created_at", "entry"]
        return ["id", "user", "tickets", "reason"]

    def get_readonly_fields(self, request, obj=None):
        return self.get_fields(request, obj) if obj else []

    def save_model(self, request, obj, form, change):
        grant_tickets(obj.user, obj.tickets, obj.reason, obj.pk, actor=request.user)


@admin.register(ComplimentarySupporter)
class ComplimentarySupporterAdmin(GrantAdmin):
    form = SupporterGrantForm
    list_display = ["user", "reason", "expires_at", "revoked_at", "granted_by", "created_at"]
    actions = ["revoke_access"]

    def get_fields(self, request, obj=None):
        if obj:
            return ["user", "reason", "expires_at", "revoked_at", "granted_by", "created_at"]
        return ["user", "reason", "expires_at"]

    def get_readonly_fields(self, request, obj=None):
        return self.get_fields(request, obj) if obj else []

    def save_model(self, request, obj, form, change):
        grant_supporter(obj.user, obj.reason, obj.pk, expires_at=obj.expires_at, actor=request.user)

    @admin.action(description="Revoke complimentary Supporter access", permissions=["add"])
    def revoke_access(self, request, queryset):
        for grant in queryset:
            revoke_supporter(grant)
            self.log_change(request, grant, "Revoked complimentary Supporter access")
        self.message_user(request, "Complimentary access revoked. Existing tickets are unchanged.")
