from django.contrib import admin, messages
from django.db.models import Count

from apps.shops.models import Shop

from .models import (
    AuditEvent,
    EmailVerificationToken,
    PasswordResetToken,
    Plan,
    ShopInvitation,
    ShopSubscription,
)
from .services import transition_subscription


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "is_active", "max_users", "max_products")
    list_filter = ("is_active", "reports_enabled", "advanced_reports_enabled")
    search_fields = ("code", "name")


@admin.action(description="Activate selected subscriptions")
def activate_subscriptions(modeladmin, request, queryset):
    for subscription in queryset.select_related("shop"):
        transition_subscription(
            subscription=subscription, status=ShopSubscription.Status.ACTIVE
        )
    messages.success(request, "Selected subscriptions were activated.")


@admin.action(description="Suspend selected subscriptions")
def suspend_subscriptions(modeladmin, request, queryset):
    for subscription in queryset.select_related("shop"):
        transition_subscription(
            subscription=subscription, status=ShopSubscription.Status.SUSPENDED
        )
    messages.warning(request, "Selected subscriptions were suspended.")


@admin.register(ShopSubscription)
class ShopSubscriptionAdmin(admin.ModelAdmin):
    list_display = (
        "shop",
        "plan",
        "status",
        "trial_ends_at",
        "current_period_end",
    )
    list_filter = ("status", "plan")
    search_fields = ("shop__name",)
    list_select_related = ("shop", "plan")
    readonly_fields = ("created_at", "updated_at", "cancelled_at")
    actions = (activate_subscriptions, suspend_subscriptions)


@admin.register(ShopInvitation)
class ShopInvitationAdmin(admin.ModelAdmin):
    list_display = ("email", "shop", "role", "invited_by", "expires_at", "state")
    list_filter = ("role", "accepted_at", "revoked_at")
    search_fields = ("email", "shop__name", "invited_by__full_name")
    list_select_related = ("shop", "invited_by")
    exclude = ("token_hash",)
    readonly_fields = (
        "shop",
        "email",
        "full_name",
        "role",
        "invited_by",
        "expires_at",
        "accepted_at",
        "revoked_at",
        "created_at",
        "updated_at",
    )

    @admin.display(description="Status")
    def state(self, invitation):
        if invitation.accepted_at:
            return "Accepted"
        if invitation.revoked_at:
            return "Revoked"
        return "Pending"

    def has_add_permission(self, request):
        return False


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = ("event", "shop", "actor", "target_user", "created_at")
    list_filter = ("event",)
    search_fields = ("shop__name", "actor__username", "target_user__username")
    list_select_related = ("shop", "actor", "target_user")
    readonly_fields = [field.name for field in AuditEvent._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


class HiddenTokenAdmin(admin.ModelAdmin):
    exclude = ("token_hash",)
    readonly_fields = ("user", "expires_at", "used_at", "created_at", "updated_at")
    list_display = ("user", "expires_at", "used_at")
    list_select_related = ("user",)

    def has_add_permission(self, request):
        return False


admin.site.register(EmailVerificationToken, HiddenTokenAdmin)
admin.site.register(PasswordResetToken, HiddenTokenAdmin)
