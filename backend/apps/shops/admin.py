from django.contrib import admin
from django.db.models import Count

from .models import Shop


@admin.register(Shop)
class ShopAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "status",
        "primary_owner",
        "subscription_status",
        "user_count",
        "product_count",
        "created_at",
    )
    list_filter = ("status", "currency", "is_active")
    search_fields = ("name", "legal_name", "phone", "email")
    readonly_fields = (
        "primary_owner",
        "status",
        "activated_at",
        "suspended_at",
        "cancelled_at",
        "created_at",
        "updated_at",
    )
    actions = None

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("primary_owner", "subscription")
            .annotate(admin_user_count=Count("users", distinct=True))
            .annotate(admin_product_count=Count("products", distinct=True))
        )

    @admin.display(description="Subscription")
    def subscription_status(self, shop):
        subscription = getattr(shop, "subscription", None)
        return subscription.status if subscription else "Missing"

    @admin.display(ordering="admin_user_count", description="Users")
    def user_count(self, shop):
        return shop.admin_user_count

    @admin.display(ordering="admin_product_count", description="Products")
    def product_count(self, shop):
        return shop.admin_product_count

    def has_delete_permission(self, request, obj=None):
        return False
