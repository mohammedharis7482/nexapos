from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.permissions import SAFE_METHODS
from rest_framework.views import APIView

from apps.inventory.exceptions import InventoryOperationError
from apps.inventory.selectors import (
    filter_inventory_products,
    inventory_products_for_user,
    inventory_summary,
    low_stock_products_for_user,
    movements_for_product,
    out_of_stock_products_for_user,
)
from apps.inventory.services import (
    adjust_inventory,
    initialize_inventory,
    update_low_stock_threshold,
)
from common.pagination import StandardResultsSetPagination
from common.params import parse_uuid_query_param
from common.permissions import IsCashierOrOwner, IsOwner
from common.views import success_response

from .serializers import (
    AdjustmentSerializer,
    InventoryItemSerializer,
    InventoryOperationResponseSerializer,
    InventorySummarySerializer,
    OpeningStockSerializer,
    StockMovementSerializer,
    ThresholdSerializer,
)

INVENTORY_PARAMETERS = [
    OpenApiParameter("search", str),
    OpenApiParameter("category", str),
    OpenApiParameter(
        "stock_status",
        str,
        enum=["NOT_INITIALIZED", "IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"],
    ),
    OpenApiParameter("is_active", str, description="OWNER: true, false, or all"),
    OpenApiParameter("page", int),
    OpenApiParameter("page_size", int),
]


def operation_error(exc: InventoryOperationError):
    raise serializers.ValidationError({exc.field: exc.message}) from exc


def product_for_request(request, product_id):
    return get_object_or_404(
        inventory_products_for_user(request.user),
        pk=product_id,
    )


def paginated_inventory_response(request, view, queryset, message):
    paginator = StandardResultsSetPagination()
    page = paginator.paginate_queryset(queryset, request, view=view)
    data = InventoryItemSerializer(page, many=True, context={"request": request}).data
    return success_response(message, paginator.get_paginated_data(data))


class InventoryListView(APIView):
    permission_classes = [IsCashierOrOwner]

    @extend_schema(
        parameters=INVENTORY_PARAMETERS,
        responses={200: InventoryItemSerializer(many=True)},
    )
    def get(self, request):
        category = parse_uuid_query_param(request, "category")
        queryset = filter_inventory_products(
            inventory_products_for_user(request.user),
            search=request.query_params.get("search", ""),
            category=category,
            stock_status=request.query_params.get("stock_status", ""),
            is_active=request.query_params.get("is_active", ""),
        )
        return paginated_inventory_response(
            request,
            self,
            queryset,
            "Inventory retrieved.",
        )


class InventoryDetailView(APIView):
    def get_permissions(self):
        classes = [IsCashierOrOwner] if self.request.method in SAFE_METHODS else [IsOwner]
        return [permission() for permission in classes]

    @extend_schema(responses={200: InventoryItemSerializer})
    def get(self, request, product_id):
        product = product_for_request(request, product_id)
        return success_response(
            "Inventory retrieved.",
            InventoryItemSerializer(product, context={"request": request}).data,
        )

    @extend_schema(request=ThresholdSerializer, responses={200: InventoryItemSerializer})
    def patch(self, request, product_id):
        product = product_for_request(request, product_id)
        serializer = ThresholdSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            update_low_stock_threshold(
                product=product,
                shop_id=request.user.shop_id,
                **serializer.validated_data,
            )
        except InventoryOperationError as exc:
            operation_error(exc)
        product = inventory_products_for_user(request.user).get(pk=product.pk)
        return success_response(
            "Low-stock threshold updated.",
            InventoryItemSerializer(product, context={"request": request}).data,
        )


class OpeningStockView(APIView):
    permission_classes = [IsOwner]

    @extend_schema(
        request=OpeningStockSerializer,
        responses={201: InventoryOperationResponseSerializer},
    )
    def post(self, request, product_id):
        product = product_for_request(request, product_id)
        serializer = OpeningStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            balance, movement = initialize_inventory(
                product=product,
                created_by=request.user,
                **serializer.validated_data,
            )
        except InventoryOperationError as exc:
            operation_error(exc)
        product = inventory_products_for_user(request.user).get(pk=balance.product_id)
        return success_response(
            "Opening stock configured.",
            {
                "inventory": InventoryItemSerializer(product, context={"request": request}).data,
                "movement": StockMovementSerializer(movement).data,
            },
            status_code=201,
        )


class AdjustmentView(APIView):
    permission_classes = [IsOwner]

    @extend_schema(
        request=AdjustmentSerializer,
        responses={200: InventoryOperationResponseSerializer},
    )
    def post(self, request, product_id):
        product = product_for_request(request, product_id)
        serializer = AdjustmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            balance, movement = adjust_inventory(
                product=product,
                created_by=request.user,
                **serializer.validated_data,
            )
        except InventoryOperationError as exc:
            operation_error(exc)
        product = inventory_products_for_user(request.user).get(pk=balance.product_id)
        return success_response(
            "Inventory adjusted.",
            {
                "inventory": InventoryItemSerializer(product, context={"request": request}).data,
                "movement": StockMovementSerializer(movement).data,
            },
        )


class MovementListView(APIView):
    permission_classes = [IsCashierOrOwner]

    @extend_schema(
        parameters=[OpenApiParameter("page", int), OpenApiParameter("page_size", int)],
        responses={200: StockMovementSerializer(many=True)},
    )
    def get(self, request, product_id):
        product = product_for_request(request, product_id)
        queryset = movements_for_product(user=request.user, product=product)
        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        data = StockMovementSerializer(page, many=True).data
        return success_response(
            "Stock movements retrieved.",
            paginator.get_paginated_data(data),
        )


class LowStockListView(APIView):
    permission_classes = [IsCashierOrOwner]

    @extend_schema(responses={200: InventoryItemSerializer(many=True)})
    def get(self, request):
        return paginated_inventory_response(
            request,
            self,
            low_stock_products_for_user(request.user),
            "Low-stock inventory retrieved.",
        )


class OutOfStockListView(APIView):
    permission_classes = [IsCashierOrOwner]

    @extend_schema(responses={200: InventoryItemSerializer(many=True)})
    def get(self, request):
        return paginated_inventory_response(
            request,
            self,
            out_of_stock_products_for_user(request.user),
            "Out-of-stock inventory retrieved.",
        )


class InventorySummaryView(APIView):
    permission_classes = [IsCashierOrOwner]

    @extend_schema(responses={200: InventorySummarySerializer})
    def get(self, request):
        return success_response(
            "Inventory summary retrieved.",
            inventory_summary(request.user),
        )
