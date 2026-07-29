from django.urls import path

from .views import (
    CategoryDetailView,
    CategoryListCreateView,
    ProductBarcodeView,
    ProductDetailView,
    ProductImportConfirmView,
    ProductImportDetailView,
    ProductImportListCreateView,
    ProductImportTemplateView,
    ProductListCreateView,
)

app_name = "products_api"

urlpatterns = [
    path("categories/", CategoryListCreateView.as_view(), name="category-list"),
    path(
        "categories/<uuid:category_id>/",
        CategoryDetailView.as_view(),
        name="category-detail",
    ),
    path("products/", ProductListCreateView.as_view(), name="product-list"),
    path(
        "products/import-template/",
        ProductImportTemplateView.as_view(),
        name="product-import-template",
    ),
    path(
        "products/imports/",
        ProductImportListCreateView.as_view(),
        name="product-import-list",
    ),
    path(
        "products/imports/<uuid:import_id>/",
        ProductImportDetailView.as_view(),
        name="product-import-detail",
    ),
    path(
        "products/imports/<uuid:import_id>/confirm/",
        ProductImportConfirmView.as_view(),
        name="product-import-confirm",
    ),
    path(
        "products/barcode/<str:barcode>/",
        ProductBarcodeView.as_view(),
        name="product-barcode",
    ),
    path(
        "products/<uuid:product_id>/",
        ProductDetailView.as_view(),
        name="product-detail",
    ),
]
