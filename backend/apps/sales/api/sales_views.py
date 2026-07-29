from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.payments.models import Payment
from apps.sales.api.serializers import (
    CompletedSaleSerializer,
    CashierFilterSerializer,
    ReceiptDataSerializer,
    SaleHistorySerializer,
)
from apps.sales.selectors import completed_sales_for_user, filter_completed_sales
from common.pagination import StandardResultsSetPagination
from common.permissions import IsCashierOrOwner
from common.views import success_response
from apps.saas.models import AuditEvent


def completed_sale_for_request(request, sale_id):
    return get_object_or_404(completed_sales_for_user(request.user), pk=sale_id)


class CompletedSaleListView(APIView):
    permission_classes = [IsCashierOrOwner]

    @extend_schema(
        parameters=[
            OpenApiParameter("search", str),
            OpenApiParameter("date_from", str),
            OpenApiParameter("date_to", str),
            OpenApiParameter("created_by", str),
            OpenApiParameter("payment_method", str, enum=Payment.Method.values),
            OpenApiParameter("ordering", str),
            OpenApiParameter("page", int),
            OpenApiParameter("page_size", int),
        ],
        responses={200: SaleHistorySerializer(many=True)},
    )
    def get(self, request):
        date_field = serializers.DateField()
        parsed_dates = {}
        for name in ("date_from", "date_to"):
            value = request.query_params.get(name)
            if value:
                try:
                    parsed_dates[name] = date_field.run_validation(value)
                except serializers.ValidationError as exc:
                    raise serializers.ValidationError({name: exc.detail}) from exc
        if (
            parsed_dates.get("date_from")
            and parsed_dates.get("date_to")
            and parsed_dates["date_from"] > parsed_dates["date_to"]
        ):
            raise serializers.ValidationError(
                {"date_to": "End date must be on or after start date."}
            )

        creator = None
        creator_value = request.query_params.get("created_by")
        if creator_value and (
            request.user.role == User.Role.OWNER or request.user.is_superuser
        ):
            try:
                creator = serializers.UUIDField().run_validation(creator_value)
            except serializers.ValidationError as exc:
                raise serializers.ValidationError({"created_by": exc.detail}) from exc

        payment_method = request.query_params.get("payment_method", "")
        if payment_method and payment_method not in Payment.Method.values:
            raise serializers.ValidationError(
                {"payment_method": "Select CASH or CARD."}
            )
        queryset = filter_completed_sales(
            completed_sales_for_user(request.user),
            search=request.query_params.get("search", ""),
            created_by=creator,
            payment_method=payment_method,
            ordering=request.query_params.get("ordering", "-completed_at"),
            **parsed_dates,
        )
        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        data = SaleHistorySerializer(page, many=True).data
        return success_response(
            "Completed sales retrieved.",
            paginator.get_paginated_data(data),
        )


class CompletedSaleDetailView(APIView):
    permission_classes = [IsCashierOrOwner]

    @extend_schema(responses={200: CompletedSaleSerializer})
    def get(self, request, sale_id):
        sale = completed_sale_for_request(request, sale_id)
        return success_response(
            "Completed sale retrieved.",
            CompletedSaleSerializer(sale).data,
        )


class SaleReceiptView(APIView):
    permission_classes = [IsCashierOrOwner]

    @extend_schema(responses={200: ReceiptDataSerializer})
    def get(self, request, sale_id):
        sale = completed_sale_for_request(request, sale_id)
        return success_response(
            "Receipt retrieved.",
            ReceiptDataSerializer({"shop": sale.shop, "sale": sale}).data,
        )


class SaleReceiptReprintView(APIView):
    permission_classes = [IsCashierOrOwner]

    @extend_schema(request=None, responses={200: ReceiptDataSerializer})
    def post(self, request, sale_id):
        sale = completed_sale_for_request(request, sale_id)
        AuditEvent.objects.create(
            shop=request.user.shop,
            actor=request.user,
            event=AuditEvent.Event.RECEIPT_REPRINTED,
            detail=sale.sale_number or "",
        )
        return success_response(
            "Receipt reprint recorded.",
            ReceiptDataSerializer({"shop": sale.shop, "sale": sale}).data,
        )


class SalesCashierListView(APIView):
    permission_classes = [IsCashierOrOwner]

    @extend_schema(responses={200: CashierFilterSerializer(many=True)})
    def get(self, request):
        users = User.objects.filter(
            shop=request.user.shop,
            is_active=True,
        ).order_by("full_name")
        if request.user.role == User.Role.CASHIER and not request.user.is_superuser:
            users = users.filter(pk=request.user.pk)
        return success_response(
            "Sales cashiers retrieved.",
            CashierFilterSerializer(users, many=True).data,
        )
