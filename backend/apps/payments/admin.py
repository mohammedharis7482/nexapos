from django.contrib import admin

from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        "sale",
        "payment_method",
        "amount",
        "recorded_by",
        "created_at",
    )
    list_filter = ("shop", "payment_method")
    search_fields = ("sale__sale_number", "reference", "recorded_by__full_name")
    readonly_fields = (
        "shop",
        "sale",
        "payment_method",
        "amount",
        "reference",
        "recorded_by",
        "created_at",
        "updated_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
