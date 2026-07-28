from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, status
from rest_framework.permissions import SAFE_METHODS
from rest_framework.views import APIView

from apps.products.models import Product
from apps.products.selectors import (
    categories_for_user,
    filter_categories,
    filter_products,
    products_for_user,
)
from apps.products.services import (
    create_category,
    create_product,
    update_category,
    update_product,
)
from apps.saas.services import SaasOperationError
from common.pagination import StandardResultsSetPagination
from common.permissions import IsCashierOrOwner, IsOwner
from common.views import success_response

from .serializers import ProductCategorySerializer, ProductSerializer

LIST_PARAMETERS = [
    OpenApiParameter("search", str),
    OpenApiParameter("is_active", str, description="true, false, or all"),
    OpenApiParameter("page", int),
    OpenApiParameter("page_size", int),
]


class StaffReadOwnerWriteMixin:
    def get_permissions(self):
        permission_classes = (
            [IsCashierOrOwner] if self.request.method in SAFE_METHODS else [IsOwner]
        )
        return [permission() for permission in permission_classes]


class CategoryListCreateView(StaffReadOwnerWriteMixin, APIView):
    @extend_schema(
        parameters=LIST_PARAMETERS,
        responses={200: ProductCategorySerializer(many=True)},
    )
    def get(self, request):
        queryset = filter_categories(
            categories_for_user(request.user),
            search=request.query_params.get("search", ""),
            is_active=request.query_params.get("is_active", ""),
        )
        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        serializer = ProductCategorySerializer(page, many=True)
        return success_response(
            "Categories retrieved.",
            paginator.get_paginated_data(serializer.data),
        )

    @extend_schema(
        request=ProductCategorySerializer,
        responses={201: ProductCategorySerializer},
    )
    def post(self, request):
        serializer = ProductCategorySerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        category = create_category(
            shop=request.user.shop,
            validated_data=serializer.validated_data,
        )
        return success_response(
            "Category created.",
            ProductCategorySerializer(category).data,
            status_code=status.HTTP_201_CREATED,
        )


class CategoryDetailView(StaffReadOwnerWriteMixin, APIView):
    def get_object(self, request, category_id):
        return get_object_or_404(
            categories_for_user(request.user),
            pk=category_id,
        )

    @extend_schema(responses={200: ProductCategorySerializer})
    def get(self, request, category_id):
        category = self.get_object(request, category_id)
        return success_response(
            "Category retrieved.",
            ProductCategorySerializer(category).data,
        )

    @extend_schema(
        request=ProductCategorySerializer,
        responses={200: ProductCategorySerializer},
    )
    def patch(self, request, category_id):
        category = self.get_object(request, category_id)
        serializer = ProductCategorySerializer(
            category,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        category = update_category(
            category=category,
            validated_data=serializer.validated_data,
        )
        return success_response(
            "Category updated.",
            ProductCategorySerializer(category).data,
        )


PRODUCT_PARAMETERS = LIST_PARAMETERS + [
    OpenApiParameter("category", str),
    OpenApiParameter("unit", str),
    OpenApiParameter(
        "ordering",
        str,
        description="name, selling_price, created_at, or updated_at; prefix - for descending",
    ),
]


class ProductListCreateView(StaffReadOwnerWriteMixin, APIView):
    @extend_schema(
        parameters=PRODUCT_PARAMETERS,
        responses={200: ProductSerializer(many=True)},
    )
    def get(self, request):
        category = request.query_params.get("category", "")
        if category:
            uuid_field = serializers.UUIDField()
            try:
                category = str(uuid_field.run_validation(category))
            except serializers.ValidationError as exc:
                raise serializers.ValidationError({"category": exc.detail}) from exc

        queryset = filter_products(
            products_for_user(request.user),
            search=request.query_params.get("search", ""),
            category=category,
            unit=request.query_params.get("unit", ""),
            is_active=request.query_params.get("is_active", ""),
            ordering=request.query_params.get("ordering", "name"),
        )
        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        serializer = ProductSerializer(page, many=True)
        return success_response(
            "Products retrieved.",
            paginator.get_paginated_data(serializer.data),
        )

    @extend_schema(request=ProductSerializer, responses={201: ProductSerializer})
    def post(self, request):
        serializer = ProductSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        try:
            product = create_product(
                shop=request.user.shop,
                validated_data=serializer.validated_data,
            )
        except SaasOperationError as exc:
            raise serializers.ValidationError(
                {"non_field_errors": exc.message}
            ) from exc
        return success_response(
            "Product created.",
            ProductSerializer(product).data,
            status_code=status.HTTP_201_CREATED,
        )


class ProductDetailView(StaffReadOwnerWriteMixin, APIView):
    def get_object(self, request, product_id):
        return get_object_or_404(products_for_user(request.user), pk=product_id)

    @extend_schema(responses={200: ProductSerializer})
    def get(self, request, product_id):
        product = self.get_object(request, product_id)
        return success_response("Product retrieved.", ProductSerializer(product).data)

    @extend_schema(request=ProductSerializer, responses={200: ProductSerializer})
    def patch(self, request, product_id):
        product = self.get_object(request, product_id)
        serializer = ProductSerializer(
            product,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        try:
            product = update_product(
                product=product,
                validated_data=serializer.validated_data,
            )
        except SaasOperationError as exc:
            raise serializers.ValidationError(
                {"non_field_errors": exc.message}
            ) from exc
        return success_response("Product updated.", ProductSerializer(product).data)


class ProductBarcodeView(APIView):
    permission_classes = [IsCashierOrOwner]

    @extend_schema(responses={200: ProductSerializer})
    def get(self, request, barcode):
        normalized_barcode = barcode.strip()
        product = get_object_or_404(
            products_for_user(request.user),
            barcode=normalized_barcode,
        )
        return success_response(
            "Product retrieved.",
            ProductSerializer(product).data,
        )
