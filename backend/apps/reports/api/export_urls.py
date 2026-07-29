from django.urls import path

from .export_views import (
    InventoryExportView,
    ProductExportView,
    SalesExportView,
    ShiftExportView,
)

app_name = "export_api"

urlpatterns = [
    path("products.csv", ProductExportView.as_view(), name="products"),
    path("inventory.csv", InventoryExportView.as_view(), name="inventory"),
    path("sales.csv", SalesExportView.as_view(), name="sales"),
    path("shifts.csv", ShiftExportView.as_view(), name="shifts"),
]
