from dataclasses import asdict, dataclass

from django.conf import settings
from django.contrib.sessions.models import Session
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.inventory.models import InventoryBalance, StockMovement
from apps.payments.models import Payment
from apps.products.models import Product, ProductCategory
from apps.sales.models import Sale, SaleItem, SaleSequence
from apps.shops.models import Shop
from apps.saas.management.commands.seed_plans import seed_example_plans
from apps.saas.models import (
    AuditEvent,
    EmailVerificationToken,
    PasswordResetToken,
    Plan,
    ShopInvitation,
    ShopSubscription,
)


@dataclass(frozen=True)
class ResetCounts:
    payments: int
    sale_items: int
    sales: int
    sale_sequences: int
    stock_movements: int
    inventory_balances: int
    products: int
    categories: int
    invitations: int
    verification_tokens: int
    password_reset_tokens: int
    audit_events: int
    subscriptions: int
    users: int
    shops: int
    sessions: int
    plans: int


def current_counts() -> ResetCounts:
    return ResetCounts(
        payments=Payment.objects.count(),
        sale_items=SaleItem.objects.count(),
        sales=Sale.objects.count(),
        sale_sequences=SaleSequence.objects.count(),
        stock_movements=StockMovement.objects.count(),
        inventory_balances=InventoryBalance.objects.count(),
        products=Product.objects.count(),
        categories=ProductCategory.objects.count(),
        invitations=ShopInvitation.objects.count(),
        verification_tokens=EmailVerificationToken.objects.count(),
        password_reset_tokens=PasswordResetToken.objects.count(),
        audit_events=AuditEvent.objects.count(),
        subscriptions=ShopSubscription.objects.count(),
        users=User.objects.count(),
        shops=Shop.objects.count(),
        sessions=Session.objects.count(),
        plans=Plan.objects.count(),
    )


def _delete(queryset) -> int:
    count = queryset.count()
    queryset.delete()
    return count


def _superuser_snapshots() -> list[dict]:
    fields = (
        "username",
        "password",
        "full_name",
        "email",
        "is_active",
        "is_staff",
        "is_superuser",
    )
    return list(User.objects.filter(is_superuser=True).values(*fields))


@transaction.atomic
def reset_data(*, keep_superuser: bool = False) -> tuple[ResetCounts, int]:
    before = current_counts()
    superusers = _superuser_snapshots() if keep_superuser else []

    _delete(Payment.objects.all())
    _delete(StockMovement.objects.all())
    _delete(SaleItem.objects.all())
    _delete(Sale.objects.all())
    _delete(SaleSequence.objects.all())
    _delete(InventoryBalance.objects.all())
    _delete(Product.objects.all())
    _delete(ProductCategory.objects.all())
    _delete(ShopInvitation.objects.all())
    _delete(AuditEvent.objects.all())
    _delete(EmailVerificationToken.objects.all())
    _delete(PasswordResetToken.objects.all())
    _delete(ShopSubscription.objects.all())
    Shop.objects.update(primary_owner=None)
    _delete(User.objects.all())
    _delete(Shop.objects.all())
    _delete(Session.objects.all())
    _delete(Plan.objects.all())

    seed_example_plans()
    if superusers:
        plan = Plan.objects.get(code=settings.DEFAULT_SAAS_PLAN_CODE)
        admin_shop = Shop.objects.create(
            name="Development Administration",
            address="Development only",
            phone="N/A",
            status=Shop.Status.ACTIVE,
            is_active=True,
            onboarding_current_step=7,
            onboarding_completed_at=timezone.now(),
        )
        primary = None
        for snapshot in superusers:
            user = User(
                shop=admin_shop,
                username=snapshot["username"],
                password=snapshot["password"],
                full_name=snapshot["full_name"],
                email=snapshot["email"],
                role=User.Role.OWNER,
                is_active=snapshot["is_active"],
                is_staff=snapshot["is_staff"],
                is_superuser=snapshot["is_superuser"],
                email_verified_at=timezone.now(),
            )
            user.save()
            primary = primary or user
        admin_shop.primary_owner = primary
        admin_shop.save(update_fields=["primary_owner", "updated_at"])
        ShopSubscription.objects.create(
            shop=admin_shop,
            plan=plan,
            status=ShopSubscription.Status.ACTIVE,
        )
    return before, len(superusers)


class Command(BaseCommand):
    help = "Reset all tenant and business data in the local development database."

    def add_arguments(self, parser):
        parser.add_argument("--confirm", action="store_true")
        parser.add_argument("--keep-superuser", action="store_true")

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("This command requires DEBUG=True.")
        if settings.SETTINGS_MODULE == "config.settings.production":
            raise CommandError("This command cannot run with production settings.")

        counts = current_counts()
        self.stdout.write(
            self.style.ERROR(
                "DESTRUCTIVE DEVELOPMENT RESET: all tenant, authentication, "
                "inventory, sales, payment, and session data will be deleted."
            )
        )
        for label, value in asdict(counts).items():
            self.stdout.write(f"{label.replace('_', ' ').title()}: {value}")

        if not options["confirm"]:
            self.stdout.write(self.style.WARNING("DRY RUN: no records were deleted."))
            return

        before, preserved = reset_data(keep_superuser=options["keep_superuser"])
        self.stdout.write(
            self.style.SUCCESS(
                "Development data reset completed atomically. "
                f"Deleted tenant users={before.users}, shops={before.shops}, "
                f"sales={before.sales}, payments={before.payments}; "
                f"preserved superusers={preserved}; plans seeded={Plan.objects.count()}."
            )
        )
