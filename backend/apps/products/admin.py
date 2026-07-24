from django.contrib import admin

from .models import Product, ProductCategory


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
