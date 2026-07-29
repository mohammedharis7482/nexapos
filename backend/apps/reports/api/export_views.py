import csv
from datetime import date

from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework import serializers
from drf_spectacular.utils import OpenApiTypes, extend_schema

from apps.inventory.models import InventoryBalance
from apps.products.models import Product
from apps.saas.models import AuditEvent
from apps.sales.models import CashierShift, Sale
from common.permissions import IsOwner

EXPORT_LIMIT = 10000


def safe_cell(value):
    text = "" if value is None else str(value)
    if text.startswith(("=", "+", "-", "@", "\t", "\r")):
        return "'" + text
    return text


class CsvExportView(APIView):
    permission_classes = [IsOwner]
    serializer_class = serializers.Serializer
    export_name = ""
    headers = ()

    def rows(self, request):
        return []

    @extend_schema(responses={(200, "text/csv"): OpenApiTypes.BINARY})
    def get(self, request):
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = (
            f'attachment; filename="nexapos-{self.export_name}-{date.today():%Y-%m-%d}.csv"'
        )
        response.write("\ufeff")
        writer = csv.writer(response)
        writer.writerow(self.headers)
        for row in self.rows(request)[:EXPORT_LIMIT]:
            writer.writerow([safe_cell(value) for value in row])
        AuditEvent.objects.create(
            shop=request.user.shop, actor=request.user,
            event=AuditEvent.Event.DATA_EXPORTED, detail=self.export_name,
        )
        return response


class ProductExportView(CsvExportView):
    export_name = "products"
    headers = ("SKU", "Name", "Category", "Barcode", "Unit", "Selling price", "Active")

    def rows(self, request):
        return list(Product.objects.filter(shop=request.user.shop).select_related(
            "category"
        ).values_list(
            "sku", "name", "category__name", "barcode", "unit",
            "selling_price", "is_active",
        ))


class InventoryExportView(CsvExportView):
    export_name = "inventory"
    headers = ("SKU", "Product", "Quantity on hand", "Low stock threshold", "Updated")

    def rows(self, request):
        return list(InventoryBalance.objects.filter(
            shop=request.user.shop
        ).select_related("product").values_list(
            "product__sku", "product__name", "quantity_on_hand",
            "low_stock_threshold", "updated_at",
        ))


class SalesExportView(CsvExportView):
    export_name = "sales"
    headers = ("Sale number", "Completed", "Cashier", "Subtotal", "Tax", "Total")

    def rows(self, request):
        queryset = Sale.objects.filter(
            shop=request.user.shop, status=Sale.Status.COMPLETED
        ).select_related("completed_by")
        if value := request.query_params.get("date_from"):
            queryset = queryset.filter(completed_at__date__gte=value)
        if value := request.query_params.get("date_to"):
            queryset = queryset.filter(completed_at__date__lte=value)
        return list(queryset.values_list(
            "sale_number", "completed_at", "completed_by__full_name",
            "subtotal", "tax_total", "grand_total",
        ))


class ShiftExportView(CsvExportView):
    export_name = "shifts"
    headers = (
        "Cashier", "Status", "Opened", "Closed", "Opening cash",
        "Expected cash", "Counted cash", "Variance",
    )

    def rows(self, request):
        return list(CashierShift.objects.filter(
            shop=request.user.shop
        ).select_related("cashier").values_list(
            "cashier__full_name", "status", "opened_at", "closed_at",
            "opening_cash", "expected_closing_cash",
            "counted_closing_cash", "cash_difference",
        ))
