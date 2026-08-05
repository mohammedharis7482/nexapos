from datetime import date, datetime, time, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Count, DecimalField, F, Q, Sum
from django.db.models.functions import Coalesce, TruncDate

from apps.inventory.models import InventoryBalance
from apps.payments.models import Payment
from apps.products.models import Product
from apps.sales.models import Sale, SaleItem

from .selectors import QAR_ZERO, QUANTITY_ZERO, _money, _quantity, shop_timezone

REPORT_ROW_LIMIT = 50


def report_bounds(user, date_from: date, date_to: date) -> tuple[datetime, datetime]:
    zone = shop_timezone(user)
    return (
        datetime.combine(date_from, time.min, tzinfo=zone),
        datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=zone),
    )


def filtered_sales(user, filters: dict, *, sale_ids=None):
    # ReportsView resolves the filtered sale ID set once and passes it to
    # every report function below, so the (possibly subquery-backed, e.g.
    # the category filter) WHERE clause is only ever evaluated once per
    # request instead of once per report section.
    if sale_ids is not None:
        return Sale.objects.filter(pk__in=sale_ids)
    start, end = report_bounds(user, filters["date_from"], filters["date_to"])
    sales = Sale.objects.filter(
        shop=user.shop,
        status=Sale.Status.COMPLETED,
        completed_at__gte=start,
        completed_at__lt=end,
    )
    if cashier_id := filters.get("cashier"):
        sales = sales.filter(completed_by_id=cashier_id)
    if payment_method := filters.get("payment_method"):
        sales = sales.filter(payments__payment_method=payment_method)
    if category_id := filters.get("category"):
        matching_ids = SaleItem.objects.filter(
            sale__in=sales,
            product__category_id=category_id,
        ).values("sale_id")
        sales = Sale.objects.filter(pk__in=matching_ids)
    return sales.distinct()


def resolve_filtered_sale_ids(user, filters: dict) -> list:
    return list(filtered_sales(user, filters).values_list("id", flat=True))


def sales_report(user, filters: dict, *, sale_ids=None) -> dict:
    sales = filtered_sales(user, filters, sale_ids=sale_ids)
    totals = sales.aggregate(
        gross_sales=Coalesce(
            Sum("grand_total"),
            QAR_ZERO,
            output_field=DecimalField(max_digits=16, decimal_places=2),
        ),
        tax_total=Coalesce(
            Sum("tax_total"),
            QAR_ZERO,
            output_field=DecimalField(max_digits=16, decimal_places=2),
        ),
        discount_total=Coalesce(
            Sum("discount_total"),
            QAR_ZERO,
            output_field=DecimalField(max_digits=16, decimal_places=2),
        ),
        completed_sales_count=Count("id"),
    )
    count = totals["completed_sales_count"]
    items_sold = SaleItem.objects.filter(sale__in=sales).aggregate(
        total=Coalesce(
            Sum("quantity"),
            QUANTITY_ZERO,
            output_field=DecimalField(max_digits=18, decimal_places=3),
        )
    )["total"]
    zone = shop_timezone(user)
    daily_rows = (
        sales.annotate(local_date=TruncDate("completed_at", tzinfo=zone))
        .values("local_date")
        .annotate(sales_total=Sum("grand_total"), sales_count=Count("id"))
        .order_by("local_date")
    )
    by_date = {row["local_date"]: row for row in daily_rows}
    days = (filters["date_to"] - filters["date_from"]).days + 1
    daily = []
    for offset in range(days):
        current = filters["date_from"] + timedelta(days=offset)
        row = by_date.get(current, {})
        daily.append(
            {
                "date": current,
                "sales_total": _money(row.get("sales_total")),
                "sales_count": row.get("sales_count", 0),
            }
        )
    return {
        "gross_sales": _money(totals["gross_sales"]),
        "completed_sales_count": count,
        "average_sale_value": _money(
            totals["gross_sales"] / count if count else QAR_ZERO
        ),
        "items_sold": _quantity(items_sold),
        "tax_total": _money(totals["tax_total"]),
        "discount_total": _money(totals["discount_total"]),
        "daily": daily,
    }


def product_report(user, filters: dict, *, sale_ids=None) -> list[dict]:
    sales = filtered_sales(user, filters, sale_ids=sale_ids)
    items = SaleItem.objects.filter(sale__in=sales)
    if category_id := filters.get("category"):
        items = items.filter(product__category_id=category_id)
    rows = (
        items.values("product_id", "product_name", "sku", "unit")
        .annotate(
            quantity_sold=Sum("quantity"),
            sales_total=Sum("line_total"),
            sales_count=Count("sale_id", distinct=True),
        )
        .order_by("-sales_total", "-quantity_sold", "product_name", "product_id")[
            :REPORT_ROW_LIMIT
        ]
    )
    return [
        {
            "rank": rank,
            "product_id": row["product_id"],
            "product_name": row["product_name"],
            "sku": row["sku"],
            "unit": row["unit"],
            "quantity_sold": _quantity(row["quantity_sold"]),
            "sales_total": _money(row["sales_total"]),
            "sales_count": row["sales_count"],
        }
        for rank, row in enumerate(rows, start=1)
    ]


def _stock_status(product: Product) -> str:
    balance = getattr(product, "inventory_balance", None)
    if balance is None:
        return "NOT_INITIALIZED"
    if balance.quantity_on_hand == 0:
        return "OUT_OF_STOCK"
    if balance.quantity_on_hand <= balance.low_stock_threshold:
        return "LOW_STOCK"
    return "IN_STOCK"


def inventory_report(user, filters: dict) -> dict:
    products = Product.objects.filter(shop=user.shop, is_active=True).select_related(
        "category", "inventory_balance"
    )
    if category_id := filters.get("category"):
        products = products.filter(category_id=category_id)
    counts = {
        "active_products": products.count(),
        "in_stock": products.filter(
            inventory_balance__quantity_on_hand__gt=F(
                "inventory_balance__low_stock_threshold"
            )
        ).count(),
        "low_stock": products.filter(
            inventory_balance__quantity_on_hand__gt=0,
            inventory_balance__quantity_on_hand__lte=F(
                "inventory_balance__low_stock_threshold"
            ),
        ).count(),
        "out_of_stock": products.filter(
            inventory_balance__quantity_on_hand=0
        ).count(),
        "not_initialized": products.filter(inventory_balance__isnull=True).count(),
    }
    total_units = InventoryBalance.objects.filter(
        shop=user.shop,
        product__in=products,
    ).aggregate(
        total=Coalesce(
            Sum("quantity_on_hand"),
            QUANTITY_ZERO,
            output_field=DecimalField(max_digits=18, decimal_places=3),
        )
    )["total"]
    rows = products.order_by("name", "id")[:REPORT_ROW_LIMIT]
    return {
        **counts,
        "quantity_on_hand": _quantity(total_units),
        "items": [
            {
                "product_id": product.id,
                "product_name": product.name,
                "sku": product.sku,
                "category": product.category.name if product.category else None,
                "unit": product.unit,
                "quantity_on_hand": (
                    product.inventory_balance.quantity_on_hand
                    if hasattr(product, "inventory_balance")
                    else None
                ),
                "low_stock_threshold": (
                    product.inventory_balance.low_stock_threshold
                    if hasattr(product, "inventory_balance")
                    else None
                ),
                "stock_status": _stock_status(product),
            }
            for product in rows
        ],
    }


def payment_report(user, filters: dict, *, sale_ids=None) -> list[dict]:
    sales = filtered_sales(user, filters, sale_ids=sale_ids)
    payments = Payment.objects.filter(shop=user.shop, sale__in=sales)
    if method := filters.get("payment_method"):
        payments = payments.filter(payment_method=method)
    rows = payments.values("payment_method").annotate(
        amount=Sum("amount"),
        payment_count=Count("id"),
        sale_count=Count("sale_id", distinct=True),
    )
    values = {row["payment_method"]: row for row in rows}
    methods = (
        [filters["payment_method"]]
        if filters.get("payment_method")
        else [Payment.Method.CASH, Payment.Method.CARD]
    )
    allocation_total = sum(
        (_money(values.get(method, {}).get("amount")) for method in methods),
        QAR_ZERO,
    )
    return [
        {
            "method": method,
            "amount": _money(values.get(method, {}).get("amount")),
            "payment_count": values.get(method, {}).get("payment_count", 0),
            "sale_count": values.get(method, {}).get("sale_count", 0),
            "percentage": (
                (
                    _money(values.get(method, {}).get("amount"))
                    * Decimal("100")
                    / allocation_total
                ).quantize(Decimal("0.01"), ROUND_HALF_UP)
                if allocation_total
                else QAR_ZERO
            ),
        }
        for method in methods
    ]


def cashier_report(user, filters: dict, *, sale_ids=None) -> list[dict]:
    sales = filtered_sales(user, filters, sale_ids=sale_ids)
    rows = (
        sales.values("completed_by_id", "completed_by__full_name")
        .annotate(
            sales_total=Sum("grand_total"),
            completed_sales_count=Count("id"),
        )
        .order_by("-sales_total", "completed_by__full_name", "completed_by_id")
    )
    item_rows = (
        SaleItem.objects.filter(sale__in=sales)
        .values("sale__completed_by_id")
        .annotate(items_sold=Sum("quantity"))
    )
    items_by_cashier = {
        row["sale__completed_by_id"]: row["items_sold"] for row in item_rows
    }
    return [
        {
            "cashier_id": row["completed_by_id"],
            "cashier_name": row["completed_by__full_name"],
            "sales_total": _money(row["sales_total"]),
            "completed_sales_count": row["completed_sales_count"],
            "average_sale_value": _money(
                row["sales_total"] / row["completed_sales_count"]
            ),
            "items_sold": _quantity(items_by_cashier.get(row["completed_by_id"])),
        }
        for row in rows
    ]
