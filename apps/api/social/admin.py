from django.contrib import admin

from .models import Comment, Follow, Reaction, Report, ShowcaseSlot


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = [
        "reason",
        "reporter",
        "card_set",
        "card",
        "comment",
        "reported_user",
        "status",
        "created_at",
    ]
    list_filter = ["status", "reason"]
    list_editable = ["status"]


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ["author", "card_set", "created_at", "deleted_at"]
    list_filter = ["created_at"]
    search_fields = ["body"]


admin.site.register(Follow)
admin.site.register(Reaction)
admin.site.register(ShowcaseSlot)
