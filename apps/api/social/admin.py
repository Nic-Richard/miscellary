from django.contrib import admin

from .models import Comment, Follow, Notification, Reaction, Report, SetFollow, ShowcaseSlot


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


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["recipient", "kind", "actor", "read_at", "created_at"]
    list_filter = ["kind"]


admin.site.register(Follow)
admin.site.register(SetFollow)
admin.site.register(Reaction)
admin.site.register(ShowcaseSlot)
