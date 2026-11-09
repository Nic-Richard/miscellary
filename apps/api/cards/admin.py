from django.contrib import admin
from django.utils import timezone

from . import tag_groups
from .models import CardDefinition, CardSet, Tag, TagMergeSuggestion
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


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ["slug", "label", "canonical", "created_at"]
    list_filter = [("canonical", admin.EmptyFieldListFilter)]
    search_fields = ["slug", "label"]
    autocomplete_fields = ["canonical"]

    def save_model(self, request, obj, form, change):
        # Merging goes through tag_groups so the group stays one level deep.
        into = None
        if "canonical" in form.changed_data and obj.canonical_id not in (None, obj.pk):
            into = obj.canonical
        if into or obj.canonical_id == obj.pk:
            obj.canonical = None
        super().save_model(request, obj, form, change)
        if into:
            tag_groups.merge(obj, into)


@admin.register(TagMergeSuggestion)
class TagMergeSuggestionAdmin(admin.ModelAdmin):
    list_display = ["tag", "into", "similarity", "status", "created_at"]
    list_filter = ["status"]
    search_fields = ["tag__slug", "into__slug"]
    readonly_fields = ["tag", "into", "similarity", "status", "created_at", "decided_at"]
    actions = ["merge_selected", "dismiss_selected"]

    def has_add_permission(self, request):
        return False

    @admin.action(description="Merge: treat these tags as the same")
    def merge_selected(self, request, queryset):
        pending = queryset.filter(status=TagMergeSuggestion.Status.PENDING).select_related(
            "tag", "into"
        )
        for suggestion in pending:
            tag_groups.merge(suggestion.tag, suggestion.into)
        self.message_user(request, f"Merged {len(pending)} tag pair(s).")

    @admin.action(description="Dismiss: these tags mean different things")
    def dismiss_selected(self, request, queryset):
        count = queryset.filter(status=TagMergeSuggestion.Status.PENDING).update(
            status=TagMergeSuggestion.Status.DISMISSED, decided_at=timezone.now()
        )
        self.message_user(request, f"Dismissed {count} suggestion(s).")
