from django.db.models import Q, QuerySet

from common.params import parse_bool_param

from .models import Product, ProductCategory


def categories_for_user(user) -> QuerySet[ProductCategory]:
    queryset = ProductCategory.objects.filter(shop=user.shop)
    if user.role == user.Role.CASHIER and not user.is_superuser:
        queryset = queryset.filter(is_active=True)
    return queryset


def filter_categories(queryset, *, search: str = "", is_active: str = ""):
    if search:
        queryset = queryset.filter(name__icontains=search.strip())
    parsed_is_active = parse_bool_param(is_active)
    if parsed_is_active is not None:
        queryset = queryset.filter(is_active=parsed_is_active)
    return queryset


def products_for_user(user) -> QuerySet[Product]:
    queryset = Product.objects.filter(shop=user.shop).select_related("category")
    if user.role == user.Role.CASHIER and not user.is_superuser:
        queryset = queryset.filter(is_active=True)
    return queryset


def filter_products(
    queryset,
    *,
    search: str = "",
    category: str = "",
    unit: str = "",
    is_active: str = "",
    ordering: str = "name",
):
    if search:
        term = search.strip()
        queryset = queryset.filter(
            Q(name__icontains=term)
            | Q(sku__icontains=term)
            | Q(barcode__icontains=term)
        )
    if category:
        queryset = queryset.filter(category_id=category)
    if unit:
        queryset = queryset.filter(unit=unit)
    parsed_is_active = parse_bool_param(is_active)
    if parsed_is_active is not None:
        queryset = queryset.filter(is_active=parsed_is_active)

    allowed_ordering = {
        "name",
        "-name",
        "selling_price",
        "-selling_price",
        "created_at",
        "-created_at",
        "updated_at",
        "-updated_at",
    }
    return queryset.order_by(ordering if ordering in allowed_ordering else "name")
