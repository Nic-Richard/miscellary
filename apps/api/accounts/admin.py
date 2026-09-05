from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import Profile, User


class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ["-created_at"]
    list_display = ["username", "email", "email_verified", "is_active", "is_staff", "created_at"]
    list_filter = ["email_verified", "is_active", "is_staff"]
    search_fields = ["username", "email"]
    readonly_fields = ["created_at", "last_login"]
    inlines = [ProfileInline]
    fieldsets = (
        (None, {"fields": ("email", "username", "password")}),
        ("Status", {"fields": ("email_verified", "is_active", "is_staff", "is_superuser")}),
        ("Permissions", {"fields": ("groups", "user_permissions")}),
        ("Dates", {"fields": ("created_at", "last_login")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "username", "password1", "password2")}),
    )
