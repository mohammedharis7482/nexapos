from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, status
from rest_framework.views import APIView

from apps.sales.exceptions import BillingOperationError
from apps.sales.models import Sale
from apps.sales.selectors import billing_sales_for_user, drafts_for_user
from apps.sales.services import (
    add_product_to_draft,
    cancel_draft_sale,
    create_draft_sale,
    complete_sale,
    remove_draft_item,
    update_draft_item_quantity,
)
from common.pagination import StandardResultsSetPagination
from common.permissions import IsCashierOrOwner
from common.views import success_response

from .serializers import (
    AddItemSerializer,
    CompleteSaleRequestSerializer,
    CompletedSaleSerializer,
    CreateDraftSerializer,
    DraftSaleSerializer,
    UpdateItemSerializer,
)


def raise_operation_error(exc: BillingOperationError):
    raise serializers.ValidationError({exc.field: exc.message}) from exc


def sale_for_request(request, sale_id):
    return get_object_or_404(drafts_for_user(request.user), pk=sale_id)


class DraftListCreateView(APIView):
    permission_classes = [IsCashierOrOwner]

    @extend_schema(
        parameters=[
            OpenApiParameter("page", int),
            OpenApiParameter("page_size", int),
        ],
        responses={200: DraftSaleSerializer(many=True)},
    )
    def get(self, request):
        queryset = drafts_for_user(request.user)
        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        data = DraftSaleSerializer(page, many=True).data
        return success_response(
            "Draft bills retrieved.",
            paginator.get_paginated_data(data),
        )

    @extend_schema(request=CreateDraftSerializer, responses={201: DraftSaleSerializer})
    def post(self, request):
        serializer = CreateDraftSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sale = create_draft_sale(user=request.user, **serializer.validated_data)
        return success_response(
            "Draft bill created.",
            DraftSaleSerializer(sale).data,
            status_code=status.HTTP_201_CREATED,
        )


class DraftDetailView(APIView):
    permission_classes = [IsCashierOrOwner]

    @extend_schema(responses={200: DraftSaleSerializer})
    def get(self, request, sale_id):
        sale = sale_for_request(request, sale_id)
        return success_response(
            "Draft bill retrieved.",
            DraftSaleSerializer(sale).data,
        )


class DraftItemCreateView(APIView):
    permission_classes = [IsCashierOrOwner]

    @extend_schema(request=AddItemSerializer, responses={200: DraftSaleSerializer})
    def post(self, request, sale_id):
        sale_for_request(request, sale_id)
        serializer = AddItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            sale = add_product_to_draft(
                sale_id=sale_id,
                user=request.user,
                **serializer.validated_data,
            )
        except BillingOperationError as exc:
            raise_operation_error(exc)
        sale = sale_for_request(request, sale.pk)
        return success_response(
            "Product added to draft.",
            DraftSaleSerializer(sale).data,
        )


class DraftItemDetailView(APIView):
    permission_classes = [IsCashierOrOwner]

    @extend_schema(request=UpdateItemSerializer, responses={200: DraftSaleSerializer})
    def patch(self, request, sale_id, item_id):
        sale_for_request(request, sale_id)
        serializer = UpdateItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            sale = update_draft_item_quantity(
                sale_id=sale_id,
                item_id=item_id,
                user=request.user,
                **serializer.validated_data,
            )
        except BillingOperationError as exc:
            raise_operation_error(exc)
        sale = sale_for_request(request, sale.pk)
        return success_response(
            "Draft item updated.",
            DraftSaleSerializer(sale).data,
        )

    @extend_schema(responses={200: DraftSaleSerializer})
    def delete(self, request, sale_id, item_id):
        sale_for_request(request, sale_id)
        try:
            sale = remove_draft_item(
                sale_id=sale_id,
                item_id=item_id,
                user=request.user,
            )
        except BillingOperationError as exc:
            raise_operation_error(exc)
        sale = sale_for_request(request, sale.pk)
        return success_response(
            "Draft item removed.",
            DraftSaleSerializer(sale).data,
        )


class DraftCancelView(APIView):
    permission_classes = [IsCashierOrOwner]

    @extend_schema(request=None, responses={200: DraftSaleSerializer})
    def post(self, request, sale_id):
        sale_for_request(request, sale_id)
        try:
            sale = cancel_draft_sale(sale_id=sale_id, user=request.user)
        except BillingOperationError as exc:
            raise_operation_error(exc)
        sale = sale_for_request(request, sale.pk)
        return success_response(
            "Draft bill cancelled.",
            DraftSaleSerializer(sale).data,
        )


class DraftCompleteView(APIView):
    permission_classes = [IsCashierOrOwner]

    @extend_schema(
        request=CompleteSaleRequestSerializer,
        responses={200: CompletedSaleSerializer},
    )
    def post(self, request, sale_id):
        get_object_or_404(billing_sales_for_user(request.user), pk=sale_id)
        serializer = CompleteSaleRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payments = [
            {
                "method": payment["method"],
                "amount": payment["amount"],
                "reference": payment.get("reference", ""),
            }
            for payment in serializer.validated_data["payments"]
        ]
        try:
            sale = complete_sale(
                sale_id=sale_id,
                user=request.user,
                payments=payments,
                amount_received=serializer.validated_data.get("amount_received"),
            )
        except BillingOperationError as exc:
            raise_operation_error(exc)
        sale = (
            Sale.objects.select_related("shop", "created_by", "completed_by")
            .prefetch_related("items", "payments")
            .get(pk=sale.pk)
        )
        return success_response(
            "Sale completed.",
            CompletedSaleSerializer(sale).data,
        )
