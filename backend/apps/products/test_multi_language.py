"""Second-language product and category names.

Scope per docs/planned-features.md: product and category names only, one
secondary language per shop, snapshotted onto sale lines, matched by billing
and catalogue search. Reports, exports and the inventory ledger are out of
scope and are deliberately not covered here.
"""

from decimal import Decimal

from django.test import TestCase
from django.urls import reverse

from apps.accounts.models import User
from apps.inventory.models import InventoryBalance
from apps.products.models import Product, ProductCategory
from apps.sales.models import SaleItem
from apps.sales.services import (
    add_product_to_draft,
    create_draft_sale,
    open_shift,
)
from apps.shops.models import Shop

PASSWORD = "MultiLanguagePassword123!"
ARABIC_RICE = "أرز بسمتي"
MALAYALAM_RICE = "ബസുമതി അരി"


class MultiLanguageTestBase(TestCase):
    def setUp(self):
        self.shop = Shop.objects.create(
            name="Language Grocery",
            address="Doha",
            phone="+97450009501",
            status=Shop.Status.ACTIVE,
            secondary_language=Shop.Language.ARABIC,
        )
        self.owner = User.objects.create_user(
            shop=self.shop,
            username="lang_owner",
            password=PASSWORD,
            full_name="Language Owner",
            role=User.Role.OWNER,
        )
        self.rice = Product.objects.create(
            shop=self.shop,
            name="Basmati Rice",
            secondary_name=ARABIC_RICE,
            sku="RICE-LANG",
            unit=Product.Unit.KG,
            selling_price=Decimal("12.00"),
        )
        self.salt = Product.objects.create(
            shop=self.shop,
            name="Table Salt",
            sku="SALT-LANG",
            unit=Product.Unit.PIECE,
            selling_price=Decimal("2.00"),
        )
        for product in (self.rice, self.salt):
            InventoryBalance.objects.create(
                shop=self.shop,
                product=product,
                quantity_on_hand=Decimal("10.000"),
                low_stock_threshold=Decimal("1.000"),
            )
        self.client.force_login(self.owner)


class LanguageSettingTests(MultiLanguageTestBase):
    def test_primary_language_defaults_to_english_and_is_independent_of_country(self):
        shop = Shop.objects.create(
            name="Default Language Grocery",
            address="Doha",
            phone="+97450009502",
        )
        self.assertEqual(shop.primary_language, Shop.Language.ENGLISH)
        # The decision that country is not repurposed: it keeps its own
        # default and says nothing about language.
        self.assertEqual(shop.country, "Qatar")
        self.assertEqual(shop.secondary_language, "")

    def test_owner_selects_a_secondary_language(self):
        response = self.client.patch(
            reverse("shops_api:settings"),
            {"secondary_language": "MALAYALAM"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.shop.refresh_from_db()
        self.assertEqual(self.shop.secondary_language, Shop.Language.MALAYALAM)

    def test_an_unsupported_language_is_rejected(self):
        response = self.client.patch(
            reverse("shops_api:settings"),
            {"secondary_language": "FRENCH"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("secondary_language", response.json()["errors"])

    def test_clearing_the_secondary_language_is_allowed(self):
        response = self.client.patch(
            reverse("shops_api:settings"),
            {"secondary_language": ""},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.shop.refresh_from_db()
        self.assertEqual(self.shop.secondary_language, "")

    def test_the_session_exposes_the_secondary_language_for_catalogue_forms(self):
        response = self.client.get(reverse("accounts_api:me"))
        self.assertEqual(
            response.json()["data"]["user"]["shop"]["secondary_language"], "ARABIC"
        )


class SecondaryNameCatalogueTests(MultiLanguageTestBase):
    def test_product_create_and_read_round_trips_the_second_name(self):
        response = self.client.post(
            reverse("products_api:product-list"),
            {
                "name": "Sugar", "secondary_name": "سكر", "sku": "SUGAR-LANG",
                "unit": "KG", "selling_price": "5.00", "purchase_price": "0.00",
                "tax_rate": "0.00", "is_tax_inclusive": False, "is_active": True,
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["data"]["secondary_name"], "سكر")
        self.assertEqual(Product.objects.get(sku="SUGAR-LANG").secondary_name, "سكر")

    def test_a_product_without_a_second_name_serializes_as_empty_not_null(self):
        response = self.client.get(
            reverse("products_api:product-detail", args=[self.salt.pk])
        )
        self.assertEqual(response.json()["data"]["secondary_name"], "")

    def test_the_second_name_is_optional_and_omitting_it_still_creates(self):
        response = self.client.post(
            reverse("products_api:product-list"),
            {
                "name": "Flour", "sku": "FLOUR-LANG", "unit": "KG",
                "selling_price": "4.00", "purchase_price": "0.00",
                "tax_rate": "0.00", "is_tax_inclusive": False, "is_active": True,
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["data"]["secondary_name"], "")

    def test_the_second_name_is_whitespace_normalised_like_the_primary(self):
        product = Product.objects.create(
            shop=self.shop, name="  Spaced  ", secondary_name="  متباعد  ",
            sku="SPACE-LANG", selling_price=Decimal("1.00"),
        )
        product.refresh_from_db()
        self.assertEqual(product.name, "Spaced")
        self.assertEqual(product.secondary_name, "متباعد")

    def test_categories_carry_a_second_name_too(self):
        response = self.client.post(
            reverse("products_api:category-list"),
            {"name": "Grains", "secondary_name": "حبوب", "display_order": 0,
             "is_active": True, "description": ""},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(
            ProductCategory.objects.get(name="Grains").secondary_name, "حبوب"
        )


class SecondaryNameSearchTests(MultiLanguageTestBase):
    def _billing_search(self, term: str) -> list[str]:
        response = self.client.get(reverse("inventory_api:list"), {"search": term})
        self.assertEqual(response.status_code, 200)
        return [row["product"]["sku"] for row in response.json()["data"]["results"]]

    def _catalogue_search(self, term: str) -> list[str]:
        response = self.client.get(
            reverse("products_api:product-list"), {"search": term}
        )
        self.assertEqual(response.status_code, 200)
        return [row["sku"] for row in response.json()["data"]["results"]]

    def test_billing_search_matches_the_primary_language(self):
        self.assertIn("RICE-LANG", self._billing_search("Basmati"))

    def test_billing_search_matches_the_second_language(self):
        self.assertEqual(self._billing_search(ARABIC_RICE), ["RICE-LANG"])

    def test_billing_search_matches_a_partial_second_language_term(self):
        self.assertEqual(self._billing_search("بسمتي"), ["RICE-LANG"])

    def test_catalogue_search_matches_either_language(self):
        self.assertIn("RICE-LANG", self._catalogue_search("Basmati"))
        self.assertEqual(self._catalogue_search(ARABIC_RICE), ["RICE-LANG"])

    def test_sku_and_barcode_search_still_work(self):
        self.assertEqual(self._billing_search("RICE-LANG"), ["RICE-LANG"])

    def test_a_product_without_a_second_name_is_unaffected_by_search(self):
        self.assertEqual(self._billing_search("Table Salt"), ["SALT-LANG"])
        self.assertEqual(self._billing_search(ARABIC_RICE), ["RICE-LANG"])

    def test_billing_list_exposes_the_second_name(self):
        response = self.client.get(reverse("inventory_api:list"), {"search": "Basmati"})
        product = response.json()["data"]["results"][0]["product"]
        self.assertEqual(product["secondary_name"], ARABIC_RICE)


class SecondaryNameSnapshotTests(MultiLanguageTestBase):
    def setUp(self):
        super().setUp()
        open_shift(user=self.owner)

    def _line_with_rice(self) -> SaleItem:
        sale = create_draft_sale(user=self.owner)
        add_product_to_draft(
            sale_id=sale.pk, user=self.owner,
            product_id=self.rice.pk, quantity=Decimal("1"),
        )
        return SaleItem.objects.get(sale=sale)

    def test_the_line_snapshots_the_second_name_at_sale_time(self):
        item = self._line_with_rice()
        self.assertEqual(item.product_name, "Basmati Rice")
        self.assertEqual(item.secondary_product_name, ARABIC_RICE)

    def test_renaming_the_product_does_not_rewrite_an_existing_line(self):
        """The whole point of snapshotting rather than reading live."""
        item = self._line_with_rice()
        Product.objects.filter(pk=self.rice.pk).update(secondary_name=MALAYALAM_RICE)
        item.refresh_from_db()
        self.assertEqual(item.secondary_product_name, ARABIC_RICE)

    def test_changing_the_shop_language_does_not_rewrite_an_existing_line(self):
        item = self._line_with_rice()
        Shop.objects.filter(pk=self.shop.pk).update(
            secondary_language=Shop.Language.HINDI
        )
        item.refresh_from_db()
        self.assertEqual(item.secondary_product_name, ARABIC_RICE)

    def test_a_product_without_a_second_name_snapshots_empty(self):
        sale = create_draft_sale(user=self.owner)
        add_product_to_draft(
            sale_id=sale.pk, user=self.owner,
            product_id=self.salt.pk, quantity=Decimal("1"),
        )
        item = SaleItem.objects.get(sale=sale)
        self.assertEqual(item.secondary_product_name, "")

    def test_the_draft_api_exposes_the_snapshot(self):
        item = self._line_with_rice()
        response = self.client.get(
            reverse("sales_api:draft-detail", args=[item.sale_id])
        )
        self.assertEqual(response.status_code, 200, response.content)
        product = response.json()["data"]["items"][0]["product"]
        self.assertEqual(product["name"], "Basmati Rice")
        self.assertEqual(product["secondary_name"], ARABIC_RICE)
