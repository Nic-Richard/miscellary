from django.contrib import admin

from .models import ModerationAction


@admin.register(ModerationAction)
class ModerationActionAdmin(admin.ModelAdmin):
    list_display = ["target_kind", "target_id", "action", "actor_id", "actor_name", "created_at"]
    list_filter = ["target_kind", "action"]
    search_fields = ["target_id", "actor_id"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
