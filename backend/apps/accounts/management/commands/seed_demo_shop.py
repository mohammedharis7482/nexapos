from decimal import Decimal
from uuid import UUID

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.products.models import Product, ProductCategory
from apps.saas.services import complete_onboarding, register_shop
from apps.shops.models import Shop

DEMO_SHOP_ID = UUID("1dab9df7-7675-41cc-9973-b2ce13aa547d")
DEMO_SHOP_NAME = "Al Hayath Groceries"
DEMO_USERNAME = "mohammedharis"
DEMO_PASSWORD = "haris7482"
DEMO_OWNER_EMAIL = "mohammedharis@nexapos.local"

CATEGORIES = (
    ("Beverages", 1),
    ("Dairy", 2),
)

PRODUCTS = (
    ("Pepsi 330ml", "DEMO2-PEPSI-330", "6281034010010", "CAN", "2.00", "2.50", "Beverages"),
    ("Mineral Water 1.5L", "DEMO2-WATER-1P5L", "6281100001508", "BOTTLE", "1.25", "2.00", "Beverages"),
    ("Almarai Milk 1L", "DEMO2-MILK-1L", "6281007023412", "BOTTLE", "5.00", "6.00", "Dairy"),
    ("Natural Yogurt 500g", "DEMO2-YOGURT-500", "6281100900002", "PACK", "3.00", "4.00", "Dairy"),
)


class Command(BaseCommand):
    help = (
        "Create the shared 'Al Hayath Groceries' demo shop and owner login "
        "through the real registration path, so it is a fully valid, "
        "already-onboarded shop identical to what public registration "
        "creates. Safe to rerun: skips creation if the shop already exists."
    )

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("seed_demo_shop is available only with DEBUG=True.")

        if Shop.objects.filter(pk=DEMO_SHOP_ID).exists():
            self.stdout.write(
                self.style.WARNING(
                    f"Shop {DEMO_SHOP_ID} already exists; skipping creation."
                )
            )
            self._print_credentials()
            return

        result = register_shop(
            shop_id=DEMO_SHOP_ID,
            shop_name=DEMO_SHOP_NAME,
            owner_full_name="Mohammed Haris",
            owner_email=DEMO_OWNER_EMAIL,
            owner_username=DEMO_USERNAME,
            password=DEMO_PASSWORD,
            address="Demo Street, Doha, Qatar",
            phone="+974 5555 0100",
        )
        shop = result.shop
        owner = result.owner

        # register_shop() only marks the owner's email verified when
        # REQUIRE_EMAIL_VERIFICATION is off; force it here so this demo
        # login works regardless of that setting, matching "fully onboarded".
        if owner.email_verified_at is None:
            owner.email_verified_at = timezone.now()
            owner.save(update_fields=["email_verified_at", "updated_at"])

        # Same call the real "finish onboarding" endpoint makes
        # (OnboardingCompleteView), so this shop lands in the identical
        # state a completed real onboarding would - not stuck in ONBOARDING.
        shop = complete_onboarding(shop)

        categories = {}
        for name, display_order in CATEGORIES:
            category, _ = ProductCategory.objects.get_or_create(
                shop=shop,
                name__iexact=name,
                defaults={"name": name, "display_order": display_order},
            )
            categories[name] = category

        for name, sku, barcode, unit, purchase, selling, category_name in PRODUCTS:
            Product.objects.get_or_create(
                shop=shop,
                sku__iexact=sku,
                defaults={
                    "name": name,
                    "sku": sku,
                    "barcode": barcode,
                    "unit": unit,
                    "purchase_price": Decimal(purchase),
                    "selling_price": Decimal(selling),
                    "category": categories[category_name],
                },
            )

        self.stdout.write(self.style.SUCCESS(f"Created shop '{shop.name}' ({shop.status})."))
        self._print_credentials()

    def _print_credentials(self):
        self.stdout.write("")
        self.stdout.write(f"  Shop ID:  {DEMO_SHOP_ID}")
        self.stdout.write(f"  Username: {DEMO_USERNAME}")
        self.stdout.write(f"  Password: {DEMO_PASSWORD}")
        self.stdout.write("")
