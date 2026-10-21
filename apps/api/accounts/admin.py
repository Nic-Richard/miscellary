import stripe
from django.contrib import admin, messages
from django.contrib.admin import helpers
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.template.response import TemplateResponse

from billing.actions import BillingError

from .lifecycle import delete_account
from .models import Profile, ReservedUsername, User


class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ["-created_at"]
    list_display = ["username", "email", "email_verified", "is_active", "is_staff", "created_at"]
    list_filter = ["email_verified", "is_active", "is_staff"]
    search_fields = ["username", "email"]
    readonly_fields = ["username_changed_at", "created_at", "last_login"]
    inlines = [ProfileInline]
    fieldsets = (
        (None, {"fields": ("email", "username", "password")}),
        ("Status", {"fields": ("email_verified", "is_active", "is_staff", "is_superuser")}),
        ("Permissions", {"fields": ("groups", "user_permissions")}),
        ("Dates", {"fields": ("username_changed_at", "created_at", "last_login")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "username", "password1", "password2")}),
    )
    actions = ["close_accounts"]

    @admin.action(description="Close selected accounts")
    def close_accounts(self, request, queryset):
        if not request.user.is_superuser:
            self.message_user(request, "Only superusers can close accounts.", messages.ERROR)
            return None
        queryset = queryset.filter(deleted_at__isnull=True, is_staff=False, is_superuser=False)
        if request.POST.get("confirm") != "yes":
            return TemplateResponse(
                request,
                "admin/accounts/close_accounts.html",
                {
                    **self.admin_site.each_context(request),
                    "title": "Close accounts",
                    "opts": self.model._meta,
                    "accounts": queryset,
                    "action_checkbox_name": helpers.ACTION_CHECKBOX_NAME,
                },
            )
        closed = 0
        for user in queryset:
            try:
                delete_account(user)
            except (BillingError, stripe.StripeError):
                self.message_user(
                    request, f"Could not close @{user.username}; try again.", messages.ERROR
                )
                continue
            self.log_change(request, user, "Closed account on request")
            closed += 1
        self.message_user(request, f"Closed {closed} account{'s' if closed != 1 else ''}.")
        return None


@admin.register(ReservedUsername)
class ReservedUsernameAdmin(admin.ModelAdmin):
    list_display = ["username", "user", "created_at"]
    search_fields = ["username"]
