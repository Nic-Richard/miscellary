from django.contrib import admin
from django.utils import timezone

from .models import Block, Post, Reply


@admin.action(description="Remove selected Lounge content")
def remove_content(modeladmin, request, queryset):
    queryset.update(deleted_at=timezone.now())


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ["title", "author", "created_at", "deleted_at"]
    list_filter = ["deleted_at"]
    search_fields = ["title", "body", "author__username"]
    actions = [remove_content]

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Reply)
class ReplyAdmin(admin.ModelAdmin):
    list_display = ["id", "author", "post", "created_at", "deleted_at"]
    list_filter = ["deleted_at"]
    search_fields = ["body", "author__username"]
    actions = [remove_content]

    def has_delete_permission(self, request, obj=None):
        return False


admin.site.register(Block)
