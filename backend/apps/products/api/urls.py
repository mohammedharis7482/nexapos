from django.urls import path

from .views import (
    CategoryDetailView,
    CategoryListCreateView,
    ProductBarcodeView,
    ProductDetailView,
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
