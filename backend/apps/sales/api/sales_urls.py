from django.urls import path

from .sales_views import (
    CompletedSaleDetailView,
    CompletedSaleListView,
    SaleReceiptView,
    SalesCashierListView,
)

app_name = "sales_history_api"

urlpatterns = [
    path("cashiers/", SalesCashierListView.as_view(), name="cashiers"),
    path("", CompletedSaleListView.as_view(), name="list"),
    path("<uuid:sale_id>/", CompletedSaleDetailView.as_view(), name="detail"),
    path(
        "<uuid:sale_id>/receipt/",
        SaleReceiptView.as_view(),
        name="receipt",
    ),
]
