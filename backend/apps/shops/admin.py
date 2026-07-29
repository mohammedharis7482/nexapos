from django.contrib import admin
from django.db import models
from django.db.models import Count

from .models import Shop


class VerificationFilter(admin.SimpleListFilter):
    title = "owner verification"
    parameter_name = "owner_verified"

    def lookups(self, request, model_admin):
        return (("yes", "Verified"), ("no", "Unverified"))

    def queryset(self, request, queryset):
        if self.value() == "yes":
            return queryset.filter(primary_owner__email_verified_at__isnull=False)
        if self.value() == "no":
            return queryset.filter(primary_owner__email_verified_at__isnull=True)
        return queryset


class CompletedSalesFilter(admin.SimpleListFilter):
    title = "completed sales"
    parameter_name = "has_completed_sales"

    def lookups(self, request, model_admin):
        return (("yes", "Has completed sales"), ("no", "No completed sales"))

    def queryset(self, request, queryset):
        if self.value() == "yes":
            return queryset.filter(admin_completed_sale_count__gt=0)
        if self.value() == "no":
            return queryset.filter(admin_completed_sale_count=0)
        return queryset


@admin.register(Shop)
class ShopAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "status",
        "primary_owner",
        "verification_status",
        "latest_verification_request",
        "subscription_status",
        "onboarding_current_step",
        "user_count",
        "product_count",
        "completed_sale_count",
        "created_at",
    )
    list_filter = (
        VerificationFilter,
        "status",
        "subscription__status",
        CompletedSalesFilter,
        "created_at",
        "currency",
        "is_active",
    )
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
            .annotate(
                admin_completed_sale_count=Count(
                    "sales",
                    filter=models.Q(sales__status="COMPLETED"),
                    distinct=True,
                )
            )
            .annotate(
                admin_latest_verification_request=models.Max(
                    "users__email_verification_tokens__created_at"
                )
            )
        )

    @admin.display(description="Verified")
    def verification_status(self, shop):
        owner = shop.primary_owner
        return "Verified" if owner and owner.email_verified_at else "Unverified"

    @admin.display(
        ordering="admin_latest_verification_request",
        description="Latest verification request",
    )
    def latest_verification_request(self, shop):
        return shop.admin_latest_verification_request

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

    @admin.display(ordering="admin_completed_sale_count", description="Completed sales")
    def completed_sale_count(self, shop):
        return shop.admin_completed_sale_count

    def has_delete_permission(self, request, obj=None):
        return False
