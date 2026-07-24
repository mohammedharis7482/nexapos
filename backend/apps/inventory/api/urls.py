from django.urls import path

from .views import (
    AdjustmentView,
    InventoryDetailView,
    InventoryListView,
    InventorySummaryView,
    LowStockListView,
    MovementListView,
    OpeningStockView,
    OutOfStockListView,
)

app_name = "inventory_api"

urlpatterns = [
    path("summary/", InventorySummaryView.as_view(), name="summary"),
    path("low-stock/", LowStockListView.as_view(), name="low-stock"),
    path("out-of-stock/", OutOfStockListView.as_view(), name="out-of-stock"),
    path(
        "products/<uuid:product_id>/opening-stock/",
        OpeningStockView.as_view(),
        name="opening-stock",
    ),
    path(
        "products/<uuid:product_id>/adjust/",
        AdjustmentView.as_view(),
        name="adjust",
    ),
    path(
        "products/<uuid:product_id>/movements/",
        MovementListView.as_view(),
        name="movements",
    ),
    path("<uuid:product_id>/", InventoryDetailView.as_view(), name="detail"),
    path("", InventoryListView.as_view(), name="list"),
]
