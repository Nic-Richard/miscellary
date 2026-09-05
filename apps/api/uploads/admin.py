from django.contrib import admin

from .models import Image


@admin.register(Image)
class ImageAdmin(admin.ModelAdmin):
    list_display = ["key", "owner", "kind", "ready", "size", "created_at"]
    list_filter = ["kind", "ready"]
