from django.contrib import admin

from .models import Sale, SaleItem


class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 0
    can_delete = False
    readonly_fields = (
        "product",
        "product_name",
        "sku",
        "barcode",
        "unit",
        "quantity",
        "unit_price",
        "tax_rate",
        "is_tax_inclusive",
        "tax_amount",
        "line_subtotal",
        "line_total",
        "created_at",
        "updated_at",
    )

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "shop",
        "status",
        "created_by",
        "grand_total",
        "created_at",
    )
    list_filter = ("shop", "status")
    search_fields = ("id", "created_by__full_name", "created_by__username")
    readonly_fields = (
        "shop",
        "created_by",
        "status",
        "subtotal",
        "tax_total",
        "discount_total",
        "grand_total",
        "cancelled_at",
        "cancelled_by",
        "created_at",
        "updated_at",
    )
    inlines = [SaleItemInline]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
