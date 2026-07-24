from django.db.models import F, Q, QuerySet

from apps.accounts.models import User
from apps.products.models import Product

from .models import InventoryBalance, StockMovement


def inventory_products_for_user(user: User) -> QuerySet[Product]:
    queryset = Product.objects.filter(shop=user.shop).select_related(
        "category",
        "inventory_balance",
    )
    if user.role == User.Role.CASHIER and not user.is_superuser:
        queryset = queryset.filter(is_active=True)
    return queryset


def filter_inventory_products(
    queryset: QuerySet[Product],
    *,
    search: str = "",
    category: str = "",
    stock_status: str = "",
    is_active: str = "",
) -> QuerySet[Product]:
    if search := search.strip():
        queryset = queryset.filter(
            Q(name__icontains=search)
            | Q(sku__icontains=search)
            | Q(barcode__icontains=search)
        )
    if category:
        queryset = queryset.filter(category_id=category)
    if is_active.lower() in {"true", "false"}:
        queryset = queryset.filter(is_active=is_active.lower() == "true")

    status = stock_status.upper()
    if status == "NOT_INITIALIZED":
        queryset = queryset.filter(inventory_balance__isnull=True)
    elif status == "OUT_OF_STOCK":
        queryset = queryset.filter(inventory_balance__quantity_on_hand=0)
    elif status == "LOW_STOCK":
        queryset = queryset.filter(
            inventory_balance__quantity_on_hand__gt=0,
            inventory_balance__quantity_on_hand__lte=F(
                "inventory_balance__low_stock_threshold"
            ),
        )
    elif status == "IN_STOCK":
        queryset = queryset.filter(
            inventory_balance__quantity_on_hand__gt=F(
                "inventory_balance__low_stock_threshold"
            )
        )
    return queryset.order_by("name", "id")


def low_stock_products_for_user(user: User) -> QuerySet[Product]:
    return filter_inventory_products(
        inventory_products_for_user(user),
        stock_status="LOW_STOCK",
    )


def out_of_stock_products_for_user(user: User) -> QuerySet[Product]:
    return filter_inventory_products(
        inventory_products_for_user(user),
        stock_status="OUT_OF_STOCK",
    )


def movements_for_product(
    *,
    user: User,
    product: Product,
) -> QuerySet[StockMovement]:
    return StockMovement.objects.filter(
        shop=user.shop,
        product=product,
    ).select_related("created_by")


def inventory_summary(user: User) -> dict[str, int]:
    products = inventory_products_for_user(user)
    balances = InventoryBalance.objects.filter(
        shop=user.shop,
        product__in=products,
    )
    return {
        "total_products": products.count(),
        "initialized": balances.count(),
        "low_stock": balances.filter(
            quantity_on_hand__gt=0,
            quantity_on_hand__lte=F("low_stock_threshold"),
        ).count(),
        "out_of_stock": balances.filter(quantity_on_hand=0).count(),
    }
