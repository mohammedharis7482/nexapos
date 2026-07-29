from django.contrib import admin

from .models import CashierShift, Sale, SaleItem, SaleSequence


@admin.register(CashierShift)
class CashierShiftAdmin(admin.ModelAdmin):
    list_display = (
        "cashier", "shop", "status", "opened_at", "closed_at",
        "opening_cash", "expected_closing_cash", "cash_difference",
    )
    list_filter = ("status", "shop")
    search_fields = ("cashier__username", "cashier__full_name", "shop__name")
    readonly_fields = (
        "expected_closing_cash", "cash_difference", "created_at", "updated_at"
    )


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
        "sale_number",
        "created_by",
        "grand_total",
        "completed_at",
        "completed_by",
        "amount_received",
        "change_due",
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


@admin.register(SaleSequence)
class SaleSequenceAdmin(admin.ModelAdmin):
    list_display = ("shop", "sequence_date", "last_value")
    readonly_fields = ("shop", "sequence_date", "last_value", "created_at", "updated_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
