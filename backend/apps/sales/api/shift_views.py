from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, status
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.sales.exceptions import BillingOperationError
from apps.sales.models import CashierShift
from apps.sales.services import active_shift_for, close_shift, open_shift
from common.pagination import StandardResultsSetPagination
from common.permissions import IsCashierOrOwner
from common.views import success_response

from .serializers import (
    CashierShiftSerializer,
    CloseShiftSerializer,
    OpenShiftSerializer,
)


def shifts_for_user(user):
    queryset = CashierShift.objects.filter(shop=user.shop).select_related(
        "cashier", "opened_by", "closed_by"
    )
    if user.role == User.Role.CASHIER and not user.is_superuser:
        queryset = queryset.filter(cashier=user)
    return queryset


def operation_error(exc):
    raise serializers.ValidationError({exc.field: exc.message}) from exc


class CurrentShiftView(APIView):
    permission_classes = [IsCashierOrOwner]

    @extend_schema(responses={200: CashierShiftSerializer})
    def get(self, request):
        shift = active_shift_for(request.user)
        return success_response(
            "Current shift retrieved.",
            CashierShiftSerializer(shift).data if shift else None,
        )


class OpenShiftView(APIView):
    permission_classes = [IsCashierOrOwner]

    @extend_schema(request=OpenShiftSerializer, responses={201: CashierShiftSerializer})
    def post(self, request):
        serializer = OpenShiftSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            shift = open_shift(user=request.user, **serializer.validated_data)
        except BillingOperationError as exc:
            operation_error(exc)
        return success_response(
            "Shift opened.", CashierShiftSerializer(shift).data,
            status_code=status.HTTP_201_CREATED,
        )


class CloseShiftView(APIView):
    permission_classes = [IsCashierOrOwner]

    @extend_schema(request=CloseShiftSerializer, responses={200: CashierShiftSerializer})
    def post(self, request, shift_id):
        serializer = CloseShiftSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            shift = close_shift(
                shift_id=shift_id, user=request.user, **serializer.validated_data
            )
        except BillingOperationError as exc:
            operation_error(exc)
        return success_response("Shift closed.", CashierShiftSerializer(shift).data)


class ShiftListView(APIView):
    permission_classes = [IsCashierOrOwner]

    @extend_schema(
        parameters=[
            OpenApiParameter("cashier", str), OpenApiParameter("status", str),
            OpenApiParameter("date_from", str), OpenApiParameter("date_to", str),
            OpenApiParameter("page", int), OpenApiParameter("page_size", int),
        ],
        responses={200: CashierShiftSerializer(many=True)},
    )
    def get(self, request):
        queryset = shifts_for_user(request.user)
        cashier = request.query_params.get("cashier")
        if cashier and request.user.role == User.Role.OWNER:
            queryset = queryset.filter(cashier_id=cashier)
        shift_status = request.query_params.get("status", "").upper()
        if shift_status:
            if shift_status not in CashierShift.Status.values:
                raise serializers.ValidationError({"status": "Select OPEN or CLOSED."})
            queryset = queryset.filter(status=shift_status)
        date_field = serializers.DateField()
        parsed = {}
        for field in ("date_from", "date_to"):
            if value := request.query_params.get(field):
                parsed[field] = date_field.run_validation(value)
        if parsed.get("date_from"):
            queryset = queryset.filter(opened_at__date__gte=parsed["date_from"])
        if parsed.get("date_to"):
            queryset = queryset.filter(opened_at__date__lte=parsed["date_to"])
        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        return success_response(
            "Shifts retrieved.",
            paginator.get_paginated_data(CashierShiftSerializer(page, many=True).data),
        )


class ShiftDetailView(APIView):
    permission_classes = [IsCashierOrOwner]

    @extend_schema(responses={200: CashierShiftSerializer})
    def get(self, request, shift_id):
        shift = get_object_or_404(shifts_for_user(request.user), pk=shift_id)
        return success_response("Shift retrieved.", CashierShiftSerializer(shift).data)
