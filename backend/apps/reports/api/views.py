from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

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
