from django.db.models import QuerySet

from apps.accounts.models import User

from .models import Sale


def billing_sales_for_user(user: User) -> QuerySet[Sale]:
    queryset = (
        Sale.objects.filter(shop=user.shop)
        .select_related("created_by", "cancelled_by")
        .prefetch_related("items__product")
    )
    if user.role == User.Role.CASHIER and not user.is_superuser:
        queryset = queryset.filter(created_by=user)
    return queryset


def drafts_for_user(user: User) -> QuerySet[Sale]:
    return billing_sales_for_user(user).filter(
        status__in=(Sale.Status.DRAFT, Sale.Status.HELD, Sale.Status.CANCELLED)
    )


def draft_for_user(*, user: User, sale_id) -> Sale:
    return drafts_for_user(user).get(pk=sale_id)


def completed_sales_for_user(user: User) -> QuerySet[Sale]:
    queryset = (
        Sale.objects.filter(shop=user.shop, status=Sale.Status.COMPLETED)
        .select_related("shop", "created_by", "completed_by")
        .prefetch_related("items", "payments")
    )
    if user.role == User.Role.CASHIER and not user.is_superuser:
        queryset = queryset.filter(created_by=user)
    return queryset


def filter_completed_sales(
    queryset: QuerySet[Sale],
    *,
    search: str = "",
    date_from=None,
    date_to=None,
    created_by=None,
    payment_method: str = "",
    ordering: str = "-completed_at",
) -> QuerySet[Sale]:
    if search := search.strip():
        queryset = queryset.filter(sale_number__icontains=search)
    if date_from:
        queryset = queryset.filter(completed_at__date__gte=date_from)
    if date_to:
        queryset = queryset.filter(completed_at__date__lte=date_to)
    if created_by:
        queryset = queryset.filter(created_by_id=created_by)
    if payment_method:
        queryset = queryset.filter(payments__payment_method=payment_method)
    allowed = {
        "completed_at",
        "-completed_at",
        "sale_number",
        "-sale_number",
        "grand_total",
        "-grand_total",
    }
    return queryset.order_by(
        ordering if ordering in allowed else "-completed_at",
        "-id",
    ).distinct()
