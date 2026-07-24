from django.db.models import QuerySet

from apps.accounts.models import User

from .models import Sale


def drafts_for_user(user: User) -> QuerySet[Sale]:
    queryset = Sale.objects.filter(shop=user.shop).select_related(
        "created_by",
        "cancelled_by",
    ).prefetch_related("items__product")
    if user.role == User.Role.CASHIER and not user.is_superuser:
        queryset = queryset.filter(created_by=user)
    return queryset


def draft_for_user(*, user: User, sale_id) -> Sale:
    return drafts_for_user(user).get(pk=sale_id)
