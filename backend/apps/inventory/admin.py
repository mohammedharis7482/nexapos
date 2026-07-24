from django.contrib import admin

from .models import InventoryBalance, StockMovement


@admin.register(InventoryBalance)
class InventoryBalanceAdmin(admin.ModelAdmin):
    list_display = (
        "product",
        "shop",
        "quantity_on_hand",
        "low_stock_threshold",
        "last_movement_at",
    )
    list_filter = ("shop", "allow_negative_stock")
    search_fields = ("product__name", "product__sku", "product__barcode")
    readonly_fields = (
        "shop",
        "product",
        "quantity_on_hand",
        "allow_negative_stock",
        "created_at",
        "updated_at",
        "last_movement_at",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = (
        "product",
        "movement_type",
        "quantity_delta",
        "quantity_before",
        "quantity_after",
        "created_by",
        "created_at",
    )
    list_filter = ("shop", "movement_type")
    search_fields = ("product__name", "product__sku", "reference", "reason")
    readonly_fields = (
        "shop",
        "product",
        "inventory_balance",
        "movement_type",
        "quantity_delta",
        "quantity_before",
        "quantity_after",
        "reason",
        "reference",
        "created_by",
        "created_at",
        "updated_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
