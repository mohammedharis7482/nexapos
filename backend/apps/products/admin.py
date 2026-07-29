from django.contrib import admin

from .models import Product, ProductCategory, ProductImport


@admin.register(ProductCategory)
class ProductCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "shop", "display_order", "is_active")
    list_filter = ("is_active", "shop")
    search_fields = ("name", "shop__name")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "sku", "shop", "unit", "selling_price", "is_active")
    list_filter = ("is_active", "unit", "shop")
    search_fields = ("name", "sku", "barcode", "shop__name")


@admin.register(ProductImport)
class ProductImportAdmin(admin.ModelAdmin):
    list_display = (
        "filename",
        "shop",
        "status",
        "total_rows",
        "products_created",
        "created_by",
        "created_at",
    )
    list_filter = ("status", "duplicate_strategy", "shop")
    search_fields = ("filename", "shop__name", "created_by__full_name")
    readonly_fields = (
        "shop",
        "created_by",
        "filename",
        "status",
        "duplicate_strategy",
        "total_rows",
        "valid_rows",
        "error_rows",
        "duplicate_rows",
        "products_created",
        "products_updated",
        "products_skipped",
        "categories_created",
        "inventory_initialized",
        "opening_movements_created",
        "warning_rows",
        "categories_to_create",
        "error_message",
        "failure_code",
        "started_at",
        "completed_at",
        "expires_at",
        "duration_ms",
        "created_at",
        "updated_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
