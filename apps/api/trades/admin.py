from django.contrib import admin

from .models import TradeOffer, TradeOfferItem


class ItemInline(admin.TabularInline):
    model = TradeOfferItem
    extra = 0


@admin.register(TradeOffer)
class TradeOfferAdmin(admin.ModelAdmin):
    list_display = ["sender", "recipient", "status", "created_at", "resolved_at"]
    list_filter = ["status"]
    inlines = [ItemInline]
