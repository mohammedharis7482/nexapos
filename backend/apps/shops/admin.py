from django.contrib import admin

from .models import Shop


@admin.register(Shop)
class ShopAdmin(admin.ModelAdmin):
    list_display = ("name", "phone", "currency", "is_active")
    list_filter = ("currency", "is_active")
    search_fields = ("name", "legal_name", "phone", "email")
    readonly_fields = ("created_at", "updated_at")
