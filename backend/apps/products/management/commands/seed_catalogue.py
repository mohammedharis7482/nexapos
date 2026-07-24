from decimal import Decimal

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.products.models import Product, ProductCategory
from apps.shops.models import Shop

CATEGORIES = (
    ("Beverages", 1),
    ("Dairy", 2),
    ("Snacks", 3),
    ("Rice & Grains", 4),
    ("Cleaning Supplies", 5),
    ("Personal Care", 6),
)

PRODUCTS = (
    ("Almarai Milk 1L", "MILK-ALM-1L", "6281007023412", "BOTTLE", "5.00", "6.00", "Dairy"),
    ("Baladna Fresh Milk 1L", "MILK-BAL-1L", "6281100530015", "BOTTLE", "5.00", "6.00", "Dairy"),
    ("Pepsi 330ml", "PEPSI-330", "6281034010010", "CAN", "2.00", "2.50", "Beverages"),
    ("Coca-Cola 330ml", "COKE-330", "5449000000996", "CAN", "2.00", "2.50", "Beverages"),
    ("Mineral Water 1.5L", "WATER-1P5L", "6281100001508", "BOTTLE", "1.25", "2.00", "Beverages"),
    ("Lays Chips", "LAYS-REG", "6281003001018", "PACK", "2.50", "3.50", "Snacks"),
    ("Basmati Rice 5kg", "RICE-BAS-5KG", "6281100505006", "BAG", "28.00", "34.00", "Rice & Grains"),
    ("White Sugar 2kg", "SUGAR-2KG", "6281100202004", "BAG", "7.00", "9.00", "Rice & Grains"),
    ("Detergent Powder 3kg", "DETERGENT-3KG", "6281100303008", "BOX", "21.00", "26.00", "Cleaning Supplies"),
    ("Tissue Box", "TISSUE-BOX", "6281100404002", "BOX", "4.00", "5.50", "Personal Care"),
    ("Shampoo 400ml", "SHAMPOO-400", "6281100604006", "BOTTLE", "10.00", "13.00", "Personal Care"),
    ("Dishwashing Liquid 1L", "DISH-1L", "6281100701002", "BOTTLE", "7.50", "10.00", "Cleaning Supplies"),
)


class Command(BaseCommand):
    help = "Seed an optional, rerunnable development catalogue for one shop."

    def add_arguments(self, parser):
        parser.add_argument("--shop-id", required=True)

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("seed_catalogue is available only with DEBUG=True.")

        try:
            shop = Shop.objects.get(pk=options["shop_id"])
        except (Shop.DoesNotExist, ValueError) as exc:
            raise CommandError("The requested shop does not exist.") from exc

        categories = {}
        for name, display_order in CATEGORIES:
            category, _ = ProductCategory.objects.get_or_create(
                shop=shop,
                name__iexact=name,
                defaults={"name": name, "display_order": display_order},
            )
            categories[name] = category

        created_count = 0
        for name, sku, barcode, unit, purchase, selling, category_name in PRODUCTS:
            _, created = Product.objects.get_or_create(
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
            created_count += int(created)

        self.stdout.write(
            self.style.SUCCESS(
                f"Catalogue ready for '{shop.name}': "
                f"{len(categories)} categories, {created_count} new products."
            )
        )
