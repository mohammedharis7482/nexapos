from datetime import timedelta

from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from common.permissions import IsOwner
from common.views import success_response

from ..selectors import (
    dashboard_summary,
    inventory_alerts,
    payment_breakdown,
    recent_sales,
    sales_trend,
    shop_timezone,
    top_products,
)
from .serializers import DashboardEnvelopeSerializer, DashboardResponseSerializer
from .serializers import (
    ReportFilterSerializer,
    ReportsEnvelopeSerializer,
    ReportsResponseSerializer,
)
from ..report_selectors import (
    cashier_report,
    inventory_report,
    payment_report,
    product_report,
    sales_report,
)


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Dashboard"],
        parameters=[
            OpenApiParameter(
                name="period",
                type=str,
                enum=["today", "7d"],
                default="today",
                description="Period used only for the top-products summary.",
            )
        ],
        responses={200: DashboardEnvelopeSerializer},
        description=(
            "Returns a shop-scoped operational dashboard. OWNER receives shop-wide "
            "metrics; CASHIER receives only their own financial and sales metrics."
        ),
    )
    def get(self, request):
        period = request.query_params.get("period", "today")
        if period not in {"today", "7d"}:
            period = "today"
        zone = shop_timezone(request.user)
        data = {
            "role": request.user.role,
            "currency": request.user.shop.currency,
            "timezone": zone.key,
            "generated_at": timezone.now(),
            "top_products_period": period,
            "summary": dashboard_summary(request.user),
            "recent_sales": recent_sales(request.user),
            "inventory_alerts": inventory_alerts(request.user),
            "top_products": top_products(request.user, period=period),
            "sales_trend": sales_trend(request.user),
            "payment_breakdown": payment_breakdown(request.user),
        }
        serializer = DashboardResponseSerializer(data)
        return success_response("Dashboard loaded.", serializer.data)


class ReportsView(APIView):
    permission_classes = [IsAuthenticated, IsOwner]

    @extend_schema(
        tags=["Reports"],
        parameters=[
            OpenApiParameter("date_from", type=str, description="Inclusive local date (YYYY-MM-DD)."),
            OpenApiParameter("date_to", type=str, description="Inclusive local date (YYYY-MM-DD)."),
            OpenApiParameter("cashier", type=str, description="Optional cashier UUID."),
            OpenApiParameter("category", type=str, description="Optional product-category UUID."),
            OpenApiParameter(
                "payment_method",
                type=str,
                enum=["CASH", "CARD"],
                description="Optional allocated payment method.",
            ),
        ],
        responses={200: ReportsEnvelopeSerializer},
        description=(
            "OWNER-only consolidated sales, product, inventory, payment, and "
            "cashier reports. All results are scoped to the authenticated shop."
        ),
    )
    def get(self, request):
        zone = shop_timezone(request.user)
        local_today = timezone.now().astimezone(zone).date()
        raw_filters = request.query_params.copy()
        raw_filters.setdefault("date_from", str(local_today - timedelta(days=6)))
        raw_filters.setdefault("date_to", str(local_today))
        filter_serializer = ReportFilterSerializer(data=raw_filters)
        filter_serializer.is_valid(raise_exception=True)
        filters = filter_serializer.validated_data
        data = {
            "currency": request.user.shop.currency,
            "timezone": zone.key,
            "generated_at": timezone.now(),
            "filters": {
                "date_from": filters["date_from"],
                "date_to": filters["date_to"],
                "cashier": filters.get("cashier"),
                "category": filters.get("category"),
                "payment_method": filters.get("payment_method"),
            },
            "sales": sales_report(request.user, filters),
            "products": product_report(request.user, filters),
            "inventory": inventory_report(request.user, filters),
            "payments": payment_report(request.user, filters),
            "cashiers": cashier_report(request.user, filters),
        }
        serializer = ReportsResponseSerializer(data)
        return success_response("Reports loaded.", serializer.data)
