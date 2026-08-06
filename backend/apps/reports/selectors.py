from datetime import datetime, time, timedelta
from decimal import Decimal, ROUND_HALF_UP
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.db.models import Count, DecimalField, F, Q, Sum
from django.db.models.functions import Coalesce, TruncDate
from django.utils import timezone

from apps.accounts.models import User
from apps.inventory.models import InventoryBalance
from apps.payments.models import Payment
from apps.products.models import Product
from apps.sales.models import Sale, SaleItem
from common.money import round_money, round_quantity

QAR_ZERO = Decimal("0.00")
QUANTITY_ZERO = Decimal("0.000")
DASHBOARD_LIST_LIMIT = 5
TREND_DAYS = 7
SAFE_TIMEZONE = "Asia/Qatar"


def shop_timezone(user: User) -> ZoneInfo:
    try:
        return ZoneInfo(user.shop.timezone)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo(SAFE_TIMEZONE)


def local_day_bounds(user: User, *, now=None) -> tuple[datetime, datetime]:
    zone = shop_timezone(user)
    local_now = (now or timezone.now()).astimezone(zone)
    start = datetime.combine(local_now.date(), time.min, tzinfo=zone)
    return start, start + timedelta(days=1)


def visible_completed_sales(user: User):
    sales = Sale.objects.filter(shop=user.shop, status=Sale.Status.COMPLETED)
    if user.role == User.Role.CASHIER and not user.is_superuser:
        sales = sales.filter(Q(completed_by=user) | Q(created_by=user))
    return sales


def _money(value) -> Decimal:
    return round_money(value or QAR_ZERO)


def _quantity(value) -> Decimal:
    return round_quantity(value or QUANTITY_ZERO)


def dashboard_summary(user: User, *, now=None) -> dict:
    start, end = local_day_bounds(user, now=now)
    today_sales = visible_completed_sales(user).filter(
        completed_at__gte=start,
        completed_at__lt=end,
    )
    sale_totals = today_sales.aggregate(
        total=Coalesce(
            Sum("grand_total"),
            QAR_ZERO,
            output_field=DecimalField(max_digits=14, decimal_places=2),
        ),
        count=Count("id"),
    )
    count = sale_totals["count"]
    total = _money(sale_totals["total"])
    items = SaleItem.objects.filter(sale__in=today_sales).aggregate(
        quantity=Coalesce(
            Sum("stock_quantity"),
            QUANTITY_ZERO,
            output_field=DecimalField(max_digits=15, decimal_places=3),
        )
    )["quantity"]

    base = {
        "sales_total_today": f"{total:.2f}",
        "completed_sales_count_today": count,
        "average_sale_value_today": f"{_money(total / count if count else QAR_ZERO):.2f}",
        "items_sold_today": f"{_quantity(items):.3f}",
    }
    if user.role == User.Role.CASHIER and not user.is_superuser:
        return {
            f"my_{key}": value
            for key, value in base.items()
        }

    active_products = Product.objects.filter(shop=user.shop, is_active=True)
    balances = InventoryBalance.objects.filter(
        shop=user.shop,
        product__is_active=True,
    )
    payment_totals = Payment.objects.filter(
        shop=user.shop,
        sale__in=today_sales,
    ).aggregate(
        cash=Coalesce(
            Sum("amount", filter=Q(payment_method=Payment.Method.CASH)),
            QAR_ZERO,
            output_field=DecimalField(max_digits=14, decimal_places=2),
        ),
        card=Coalesce(
            Sum("amount", filter=Q(payment_method=Payment.Method.CARD)),
            QAR_ZERO,
            output_field=DecimalField(max_digits=14, decimal_places=2),
        ),
    )
    split_total = today_sales.annotate(
        method_count=Count("payments__payment_method", distinct=True)
    ).filter(method_count__gt=1).aggregate(
        total=Coalesce(
            Sum("grand_total"),
            QAR_ZERO,
            output_field=DecimalField(max_digits=14, decimal_places=2),
        )
    )["total"]
    return {
        **base,
        "cash_sales_total_today": f"{_money(payment_totals['cash']):.2f}",
        "card_sales_total_today": f"{_money(payment_totals['card']):.2f}",
        "split_sales_total_today": f"{_money(split_total):.2f}",
        "low_stock_count": balances.filter(
            quantity_on_hand__gt=0,
            quantity_on_hand__lte=F("low_stock_threshold"),
        ).count(),
        "out_of_stock_count": balances.filter(quantity_on_hand=0).count(),
        "inventory_not_initialized_count": active_products.filter(
            inventory_balance__isnull=True
        ).count(),
        "active_product_count": active_products.count(),
    }


def recent_sales(user: User) -> list[dict]:
    rows = (
        visible_completed_sales(user)
        .select_related("completed_by")
        .annotate(item_count=Count("items"))
        .prefetch_related("payments")
        .order_by("-completed_at", "-id")[:DASHBOARD_LIST_LIMIT]
    )
    return [
        {
            "id": sale.id,
            "sale_number": sale.sale_number,
            "completed_at": sale.completed_at,
            "cashier_name": sale.completed_by.full_name,
            "item_count": sale.item_count,
            "payment_methods": sorted(
                {payment.payment_method for payment in sale.payments.all()}
            ),
            "grand_total": sale.grand_total,
        }
        for sale in rows
    ]


def _alert_row(product: Product, status: str) -> dict:
    balance = getattr(product, "inventory_balance", None)
    return {
        "product_id": product.id,
        "product_name": product.name,
        "sku": product.sku,
        "category": product.category.name if product.category else None,
        "unit": product.unit,
        "quantity_on_hand": balance.quantity_on_hand if balance else None,
        "low_stock_threshold": balance.low_stock_threshold if balance else None,
        "stock_status": status,
    }


def inventory_alerts(user: User) -> dict[str, list[dict]]:
    products = Product.objects.filter(shop=user.shop, is_active=True).select_related(
        "category", "inventory_balance"
    )
    low = products.filter(
        inventory_balance__quantity_on_hand__gt=0,
        inventory_balance__quantity_on_hand__lte=F(
            "inventory_balance__low_stock_threshold"
        ),
    ).order_by("inventory_balance__quantity_on_hand", "name")[:DASHBOARD_LIST_LIMIT]
    out = products.filter(
        inventory_balance__quantity_on_hand=0
    ).order_by("name")[:DASHBOARD_LIST_LIMIT]
    missing = products.filter(inventory_balance__isnull=True).order_by(
        "name"
    )[:DASHBOARD_LIST_LIMIT]
    return {
        "low_stock": [_alert_row(product, "LOW_STOCK") for product in low],
        "out_of_stock": [_alert_row(product, "OUT_OF_STOCK") for product in out],
        "not_initialized": [
            _alert_row(product, "NOT_INITIALIZED") for product in missing
        ],
    }


def top_products(user: User, *, period: str = "today", now=None) -> list[dict]:
    today_start, today_end = local_day_bounds(user, now=now)
    start = today_start if period == "today" else today_start - timedelta(days=6)
    rows = (
        SaleItem.objects.filter(
            sale__in=visible_completed_sales(user),
            sale__completed_at__gte=start,
            sale__completed_at__lt=today_end,
        )
        .values("product_id", "product_name", "sku")
        .annotate(quantity_sold=Sum("stock_quantity"), sales_total=Sum("line_total"))
        .order_by("-quantity_sold", "-sales_total", "product_name", "product_id")[
            :DASHBOARD_LIST_LIMIT
        ]
    )
    return [
        {
            "rank": rank,
            "product_id": row["product_id"],
            "product_name": row["product_name"],
            "sku": row["sku"],
            "quantity_sold": _quantity(row["quantity_sold"]),
            "sales_total": _money(row["sales_total"]),
        }
        for rank, row in enumerate(rows, start=1)
    ]


def sales_trend(user: User, *, now=None) -> list[dict]:
    zone = shop_timezone(user)
    today_start, today_end = local_day_bounds(user, now=now)
    first_day = today_start - timedelta(days=TREND_DAYS - 1)
    rows = (
        visible_completed_sales(user)
        .filter(completed_at__gte=first_day, completed_at__lt=today_end)
        .annotate(local_date=TruncDate("completed_at", tzinfo=zone))
        .values("local_date")
        .annotate(sales_total=Sum("grand_total"), completed_sales_count=Count("id"))
        .order_by("local_date")
    )
    by_date = {row["local_date"]: row for row in rows}
    return [
        {
            "date": (first_day + timedelta(days=offset)).date(),
            "sales_total": _money(
                by_date.get((first_day + timedelta(days=offset)).date(), {}).get(
                    "sales_total"
                )
            ),
            "completed_sales_count": by_date.get(
                (first_day + timedelta(days=offset)).date(), {}
            ).get("completed_sales_count", 0),
        }
        for offset in range(TREND_DAYS)
    ]


def payment_breakdown(user: User, *, now=None) -> list[dict]:
    start, end = local_day_bounds(user, now=now)
    sales = visible_completed_sales(user).filter(
        completed_at__gte=start, completed_at__lt=end
    )
    rows = Payment.objects.filter(shop=user.shop, sale__in=sales).values(
        "payment_method"
    ).annotate(amount=Sum("amount"))
    amounts = {row["payment_method"]: _money(row["amount"]) for row in rows}
    total = sum(amounts.values(), QAR_ZERO)
    return [
        {
            "method": method,
            "amount": amounts.get(method, QAR_ZERO),
            "percentage": (
                (amounts.get(method, QAR_ZERO) * 100 / total).quantize(
                    Decimal("0.01"), ROUND_HALF_UP
                )
                if total
                else QAR_ZERO
            ),
        }
        for method in (Payment.Method.CASH, Payment.Method.CARD)
    ]
