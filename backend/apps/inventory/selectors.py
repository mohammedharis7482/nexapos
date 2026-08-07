from django.db.models import Count, F, Q, QuerySet

from apps.accounts.models import User
from apps.products.models import Product
from common.params import parse_bool_param

from .models import InventoryBalance, StockMovement


def stock_status_for(balance: InventoryBalance | None) -> str:
    if balance is None:
        return "NOT_INITIALIZED"
    if balance.quantity_on_hand == 0:
        return "OUT_OF_STOCK"
    if balance.quantity_on_hand <= balance.low_stock_threshold:
        return "LOW_STOCK"
    return "IN_STOCK"


def inventory_products_for_user(user: User) -> QuerySet[Product]:
    queryset = (
        Product.objects.filter(shop=user.shop)
        .select_related("category", "inventory_balance")
        # The billing grid renders every multi-pricing product's packet
        # buttons, so packets must come along or each card costs a query.
        .prefetch_related("packets")
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
            | Q(secondary_name__icontains=search)
            | Q(sku__icontains=search)
            | Q(barcode__icontains=search)
        )
    if category:
        queryset = queryset.filter(category_id=category)
    parsed_is_active = parse_bool_param(is_active)
    if parsed_is_active is not None:
        queryset = queryset.filter(is_active=parsed_is_active)

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
    # inventory_balance is a OneToOneField, so joining to it never fans a
    # product row out into more than one - a single conditional-Count
    # aggregate is safe here (unlike a reverse FK/M2M join, which would be).
    counts = products.aggregate(
        total_products=Count("id"),
        initialized=Count("inventory_balance"),
        low_stock=Count(
            "inventory_balance",
            filter=Q(
                inventory_balance__quantity_on_hand__gt=0,
                inventory_balance__quantity_on_hand__lte=F(
                    "inventory_balance__low_stock_threshold"
                ),
            ),
        ),
        out_of_stock=Count(
            "inventory_balance",
            filter=Q(inventory_balance__quantity_on_hand=0),
        ),
    )
    return counts
