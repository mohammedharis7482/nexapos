from dataclasses import dataclass

from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.inventory.models import InventoryBalance, StockMovement
from apps.payments.models import Payment
from apps.products.models import Product, ProductCategory
from apps.sales.models import Sale, SaleItem, SaleSequence
from apps.shops.models import Shop

from .models import (
    AuditEvent,
    EmailVerificationToken,
    PasswordResetToken,
    ShopInvitation,
    ShopSubscription,
)


@dataclass(frozen=True)
class TenantCounts:
    users: int
    products: int
    inventory_balances: int
    stock_movements: int
    drafts: int
    completed_sales: int
    payments: int
    receipts: int
    invitations: int
    tokens: int
    subscriptions: int

    @property
    def has_business_data(self) -> bool:
        return any(
            (
                self.products,
                self.inventory_balances,
                self.stock_movements,
                self.drafts,
                self.completed_sales,
                self.payments,
            )
        )


def tenant_counts(shop: Shop) -> TenantCounts:
    return TenantCounts(
        users=User.objects.filter(shop=shop).count(),
        products=Product.objects.filter(shop=shop).count(),
        inventory_balances=InventoryBalance.objects.filter(shop=shop).count(),
        stock_movements=StockMovement.objects.filter(shop=shop).count(),
        drafts=Sale.objects.filter(shop=shop, status=Sale.Status.DRAFT).count(),
        completed_sales=Sale.objects.filter(
            shop=shop, status=Sale.Status.COMPLETED
        ).count(),
        payments=Payment.objects.filter(shop=shop).count(),
        # Receipts are rendered from immutable completed sales; there is no
        # separate receipt table in the current domain model.
        receipts=Sale.objects.filter(
            shop=shop, status=Sale.Status.COMPLETED
        ).count(),
        invitations=ShopInvitation.objects.filter(shop=shop).count(),
        tokens=EmailVerificationToken.objects.filter(user__shop=shop).count()
        + PasswordResetToken.objects.filter(user__shop=shop).count(),
        subscriptions=ShopSubscription.objects.filter(shop=shop).count(),
    )


def classify_tenant(shop: Shop, counts: TenantCounts) -> str:
    if counts.has_business_data:
        return "HAS_BUSINESS_DATA"
    if shop.status == Shop.Status.SUSPENDED:
        return "SUSPENDED"
    if shop.status == Shop.Status.CANCELLED:
        return "CANCELLED"
    owner = shop.primary_owner
    if owner is None or not ShopSubscription.objects.filter(shop=shop).exists():
        return "INCONSISTENT"
    if owner.email_verified_at is None:
        has_usable_token = EmailVerificationToken.objects.filter(
            user=owner, used_at__isnull=True, expires_at__gt=timezone.now()
        ).exists()
        return "UNVERIFIED_RECENT" if has_usable_token else "UNVERIFIED_EXPIRED"
    if shop.status == Shop.Status.ONBOARDING:
        return "VERIFIED_ONBOARDING"
    if shop.status in (Shop.Status.TRIAL, Shop.Status.ACTIVE, Shop.Status.PAST_DUE):
        return "ACTIVE_VALID"
    return "ABANDONED_EMPTY"


@transaction.atomic
def delete_test_tenant(shop: Shop) -> dict[str, int]:
    """Delete a developer-selected tenant in dependency-safe order."""
    counts: dict[str, int] = {}

    def remove(label: str, queryset) -> None:
        deleted, _detail = queryset.delete()
        counts[label] = deleted

    remove("payments", Payment.objects.filter(shop=shop))
    remove("stock_movements", StockMovement.objects.filter(shop=shop))
    remove("sale_items", SaleItem.objects.filter(sale__shop=shop))
    remove("sales", Sale.objects.filter(shop=shop))
    remove("sale_sequences", SaleSequence.objects.filter(shop=shop))
    remove("inventory_balances", InventoryBalance.objects.filter(shop=shop))
    remove("products", Product.objects.filter(shop=shop))
    remove("product_categories", ProductCategory.objects.filter(shop=shop))
    remove("invitations", ShopInvitation.objects.filter(shop=shop))
    remove("audit_events", AuditEvent.objects.filter(shop=shop))
    remove("subscriptions", ShopSubscription.objects.filter(shop=shop))
    shop.primary_owner = None
    shop.save(update_fields=["primary_owner", "updated_at"])
    remove("users", User.objects.filter(shop=shop))
    deleted, _detail = Shop.objects.filter(pk=shop.pk).delete()
    counts["shops"] = deleted
    return counts
