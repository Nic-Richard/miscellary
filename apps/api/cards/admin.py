from django.contrib import admin

from .models import CardDefinition, CardSet
from .removal import remove_set


class CardInline(admin.TabularInline):
    model = CardDefinition
    extra = 0
    fields = ["title", "rarity", "template_key", "template_version"]
    readonly_fields = ["title", "rarity", "template_key", "template_version"]


@admin.register(CardSet)
class CardSetAdmin(admin.ModelAdmin):
    list_display = ["title", "creator", "status", "published_at"]
    list_filter = ["status"]
    search_fields = ["title", "slug", "creator__username"]
    readonly_fields = ["slug", "published_at", "deleted_at"]
    inlines = [CardInline]
    actions = ["remove_for_violation"]

    @admin.action(description="Remove for Terms violation (wipes all copies)")
    def remove_for_violation(self, request, queryset):
        wiped = sum(remove_set(s) for s in queryset.exclude(status=CardSet.Status.REMOVED))
        self.message_user(request, f"Removed {queryset.count()} set(s), wiped {wiped} copies.")
