from django.contrib import admin

from .models import OwnedCard, PackOpening, SetPoints


@admin.register(PackOpening)
class PackOpeningAdmin(admin.ModelAdmin):
    list_display = ["user", "card_set", "kind", "opened_at"]
    list_filter = ["kind"]


@admin.register(OwnedCard)
class OwnedCardAdmin(admin.ModelAdmin):
    list_display = ["owner", "card", "acquired_at"]
    search_fields = ["owner__username", "card__title"]


@admin.register(SetPoints)
class SetPointsAdmin(admin.ModelAdmin):
    list_display = ["user", "card_set", "balance"]
