from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import serializers, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import SAFE_METHODS
from rest_framework.views import APIView

from apps.products.import_services import (
    ProductImportError,
    confirm_product_import,
    csv_template,
    error_report_csv,
    validate_product_import,
)
from apps.products.models import Product, ProductImport
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
from common.params import parse_uuid_query_param
from common.permissions import IsCashierOrOwner, IsOwner
from common.views import success_response

from .serializers import (
    ProductCategorySerializer,
    ProductImportConfirmSerializer,
    ProductImportRowSerializer,
    ProductImportSerializer,
    ProductImportUploadSerializer,
    ProductSerializer,
)

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
        category = parse_uuid_query_param(request, "category")

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


class ProductImportTemplateView(APIView):
    permission_classes = [IsOwner]

    @extend_schema(
        responses={
            200: OpenApiResponse(
                response=OpenApiTypes.BINARY,
                description="UTF-8 CSV product import template.",
            )
        }
    )
    def get(self, request):
        response = HttpResponse(csv_template(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = (
            'attachment; filename="nexapos-product-import-template.csv"'
        )
        return response


class ProductImportListCreateView(APIView):
    permission_classes = [IsOwner]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        parameters=[OpenApiParameter("page", int), OpenApiParameter("page_size", int)],
        responses={200: ProductImportSerializer(many=True)},
    )
    def get(self, request):
        queryset = ProductImport.objects.filter(shop=request.user.shop).select_related(
            "created_by"
        )
        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        data = ProductImportSerializer(page, many=True).data
        return success_response(
            "Product imports retrieved.",
            paginator.get_paginated_data(data),
        )

    @extend_schema(
        request=ProductImportUploadSerializer,
        responses={201: ProductImportSerializer},
    )
    def post(self, request):
        serializer = ProductImportUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uploaded_file = serializer.validated_data["file"]
        try:
            product_import = validate_product_import(
                shop=request.user.shop,
                created_by=request.user,
                filename=uploaded_file.name,
                content=uploaded_file.read(),
            )
        except ProductImportError as exc:
            raise serializers.ValidationError(
                {
                    "code": exc.code,
                    "detail": exc.message,
                    "import_errors": exc.errors,
                }
            ) from exc
        preview_rows = ProductImportRowSerializer(
            product_import.rows.all()[:25],
            many=True,
        ).data
        response_data = ProductImportSerializer(product_import).data
        response_data["preview_rows"] = preview_rows
        response_data["errors"] = [
            issue for row in preview_rows for issue in row["errors"]
        ]
        response_data["warnings"] = [
            issue for row in preview_rows for issue in row["warnings"]
        ]
        return success_response(
            "CSV validated.",
            response_data,
            status_code=status.HTTP_201_CREATED,
        )


class ProductImportDetailView(APIView):
    permission_classes = [IsOwner]

    def get_object(self, request, import_id):
        return get_object_or_404(
            ProductImport.objects.filter(shop=request.user.shop).select_related(
                "created_by"
            ),
            pk=import_id,
        )

    @extend_schema(
        parameters=[
            OpenApiParameter("page", int),
            OpenApiParameter("page_size", int),
            OpenApiParameter("severity", str, enum=["all", "error", "warning"]),
            OpenApiParameter("column", str),
            OpenApiParameter("search", str),
        ],
        responses={200: ProductImportSerializer},
    )
    def get(self, request, import_id):
        product_import = self.get_object(request, import_id)
        severity = request.query_params.get("severity", "all")
        column = request.query_params.get("column", "").strip().casefold()
        search = request.query_params.get("search", "").strip().casefold()
        rows = list(product_import.rows.all())
        if severity == "error":
            rows = [row for row in rows if row.errors]
        elif severity == "warning":
            rows = [row for row in rows if row.warnings]
        if column:
            rows = [
                row
                for row in rows
                if any(
                    issue.get("column", "").casefold() == column
                    for issue in [*row.errors, *row.warnings]
                )
            ]
        if search:
            rows = [
                row
                for row in rows
                if search in row.normalized_data.get("name", "").casefold()
                or any(
                    search
                    in " ".join(
                        (
                            str(issue.get("column", "")),
                            str(issue.get("value", "")),
                            str(issue.get("human_message", "")),
                        )
                    ).casefold()
                    for issue in [*row.errors, *row.warnings]
                )
            ]
        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(rows, request, view=self)
        serialized_rows = ProductImportRowSerializer(page, many=True).data
        data = ProductImportSerializer(product_import).data
        data["rows"] = paginator.get_paginated_data(serialized_rows)
        data["preview_rows"] = serialized_rows
        data["errors"] = [
            issue for row in serialized_rows for issue in row["errors"]
        ]
        data["warnings"] = [
            issue for row in serialized_rows for issue in row["warnings"]
        ]
        return success_response("Product import retrieved.", data)


class ProductImportConfirmView(APIView):
    permission_classes = [IsOwner]

    @extend_schema(
        request=ProductImportConfirmSerializer,
        responses={200: ProductImportSerializer},
    )
    def post(self, request, import_id):
        product_import = get_object_or_404(
            ProductImport.objects.filter(shop=request.user.shop),
            pk=import_id,
        )
        serializer = ProductImportConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            completed = confirm_product_import(
                product_import=product_import,
                duplicate_strategy=serializer.validated_data["duplicate_strategy"],
                requested_by=request.user,
            )
        except ProductImportError as exc:
            raise serializers.ValidationError(
                {
                    "code": exc.code,
                    "detail": exc.message,
                    "import_errors": exc.errors,
                }
            ) from exc
        return success_response(
            "Products imported.",
            ProductImportSerializer(completed).data,
        )


class ProductImportErrorReportView(APIView):
    permission_classes = [IsOwner]

    @extend_schema(
        responses={
            200: OpenApiResponse(
                response=OpenApiTypes.BINARY,
                description="UTF-8 CSV report containing blocking import errors.",
            )
        }
    )
    def get(self, request, import_id):
        product_import = get_object_or_404(
            ProductImport.objects.filter(shop=request.user.shop),
            pk=import_id,
        )
        response = HttpResponse(
            error_report_csv(product_import),
            content_type="text/csv; charset=utf-8",
        )
        response["Content-Disposition"] = (
            f'attachment; filename="nexapos-import-errors-{product_import.id}.csv"'
        )
        return response
