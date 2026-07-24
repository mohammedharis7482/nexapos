from decimal import Decimal

from django.db import IntegrityError, transaction
from django.test import TestCase
from django.urls import reverse

from apps.accounts.models import User
from apps.shops.models import Shop

from .models import Product, ProductCategory

PASSWORD = "CatalogueFoundationPassword123!"


class CatalogueApiTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.shop = Shop.objects.create(
            name="Catalogue Grocery",
            address="Doha, Qatar",
            phone="+974 5555 0301",
        )
        cls.other_shop = Shop.objects.create(
            name="Other Catalogue Grocery",
            address="Al Rayyan, Qatar",
            phone="+974 5555 0302",
        )
        cls.owner = User.objects.create_user(
            shop=cls.shop,
            username="catalogue-owner",
            password=PASSWORD,
            full_name="Catalogue Owner",
            role=User.Role.OWNER,
        )
        cls.cashier = User.objects.create_user(
            shop=cls.shop,
            username="catalogue-cashier",
            password=PASSWORD,
            full_name="Catalogue Cashier",
        )
        cls.other_owner = User.objects.create_user(
            shop=cls.other_shop,
            username="other-catalogue-owner",
            password=PASSWORD,
            full_name="Other Catalogue Owner",
            role=User.Role.OWNER,
        )
        cls.dairy = ProductCategory.objects.create(
            shop=cls.shop,
            name="Dairy",
            display_order=2,
        )
        cls.beverages = ProductCategory.objects.create(
            shop=cls.shop,
            name="Beverages",
            display_order=1,
        )
        cls.inactive_category = ProductCategory.objects.create(
            shop=cls.shop,
            name="Inactive",
            display_order=3,
            is_active=False,
        )
        cls.other_category = ProductCategory.objects.create(
            shop=cls.other_shop,
            name="Dairy",
        )
        cls.milk = Product.objects.create(
            shop=cls.shop,
            category=cls.dairy,
            name="Almarai Full Fat Milk 1L",
            sku="MILK-001",
            barcode="6281007023412",
            unit=Product.Unit.BOTTLE,
            purchase_price=Decimal("5.00"),
            selling_price=Decimal("6.00"),
        )
        cls.cola = Product.objects.create(
            shop=cls.shop,
            category=cls.beverages,
            name="Coca-Cola 330ml",
            sku="COLA-001",
            barcode="5449000000996",
            unit=Product.Unit.CAN,
            purchase_price=Decimal("2.00"),
            selling_price=Decimal("2.50"),
            is_active=False,
        )
        cls.other_milk = Product.objects.create(
            shop=cls.other_shop,
            category=cls.other_category,
            name="Other Shop Milk",
            sku="MILK-001",
            barcode="6281007023412",
            unit=Product.Unit.BOTTLE,
            selling_price=Decimal("7.00"),
        )

    def login(self, user):
        self.client.force_login(
            user,
            backend="common.authentication.ShopModelBackend",
        )

    @staticmethod
    def product_payload(**overrides):
        payload = {
            "name": "Baladna Fresh Milk 1L",
            "description": "",
            "sku": "MILK-002",
            "barcode": "6281007000001",
            "unit": "BOTTLE",
            "purchase_price": "5.25",
            "selling_price": "6.25",
            "tax_rate": "0.00",
            "is_tax_inclusive": False,
            "is_active": True,
        }
        payload.update(overrides)
        return payload


class CategoryApiTests(CatalogueApiTestCase):
    def test_owner_creates_and_updates_category(self):
        self.login(self.owner)
        create_response = self.client.post(
            reverse("products_api:category-list"),
            {
                "name": "  Snacks  ",
                "description": "Packaged snacks",
                "display_order": 4,
            },
            content_type="application/json",
        )
        self.assertEqual(create_response.status_code, 201)
        category_id = create_response.json()["data"]["id"]
        self.assertEqual(create_response.json()["data"]["name"], "Snacks")

        update_response = self.client.patch(
            reverse("products_api:category-detail", args=[category_id]),
            {"is_active": False},
            content_type="application/json",
        )
        self.assertEqual(update_response.status_code, 200)
        self.assertFalse(update_response.json()["data"]["is_active"])

    def test_cashier_reads_active_categories_but_cannot_create(self):
        self.login(self.cashier)
        response = self.client.get(reverse("products_api:category-list"))
        names = [item["name"] for item in response.json()["data"]["results"]]
        self.assertEqual(names, ["Beverages", "Dairy"])
        self.assertNotIn("Inactive", names)

        denied = self.client.post(
            reverse("products_api:category-list"),
            {"name": "Denied"},
            content_type="application/json",
        )
        self.assertEqual(denied.status_code, 403)

    def test_category_name_unique_per_shop_case_insensitively(self):
        self.login(self.owner)
        response = self.client.post(
            reverse("products_api:category-list"),
            {"name": "dAiRy"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("name", response.json()["errors"])

        duplicate_other_shop = ProductCategory.objects.create(
            shop=self.other_shop,
            name="Beverages",
        )
        self.assertEqual(duplicate_other_shop.name, "Beverages")

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                ProductCategory.objects.create(shop=self.shop, name="DAIRY")

    def test_category_shop_isolation_and_order(self):
        self.login(self.owner)
        response = self.client.get(reverse("products_api:category-list"))
        names = [item["name"] for item in response.json()["data"]["results"]]
        self.assertEqual(names, ["Beverages", "Dairy", "Inactive"])

        hidden = self.client.get(
            reverse("products_api:category-detail", args=[self.other_category.id])
        )
        self.assertEqual(hidden.status_code, 404)


class ProductApiTests(CatalogueApiTestCase):
    def test_owner_creates_and_updates_product_with_safe_response(self):
        self.login(self.owner)
        response = self.client.post(
            reverse("products_api:product-list"),
            self.product_payload(category_id=str(self.dairy.id)),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()["data"]
        self.assertEqual(data["category"]["name"], "Dairy")
        self.assertEqual(data["selling_price"], "6.25")
        self.assertNotIn("shop", data)
        self.assertNotIn("shop_id", data)
        self.assertNotIn("quantity", data)

        updated = self.client.patch(
            reverse("products_api:product-detail", args=[data["id"]]),
            {"selling_price": "6.50", "is_active": False},
            content_type="application/json",
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["data"]["selling_price"], "6.50")
        self.assertFalse(updated.json()["data"]["is_active"])

    def test_cashier_reads_only_active_products_and_cannot_create(self):
        self.login(self.cashier)
        response = self.client.get(reverse("products_api:product-list"))
        names = [item["name"] for item in response.json()["data"]["results"]]
        self.assertEqual(names, [self.milk.name])

        denied = self.client.post(
            reverse("products_api:product-list"),
            self.product_payload(),
            content_type="application/json",
        )
        self.assertEqual(denied.status_code, 403)
        hidden = self.client.get(
            reverse("products_api:product-detail", args=[self.cola.id])
        )
        self.assertEqual(hidden.status_code, 404)

    def test_sku_and_barcode_unique_per_shop(self):
        self.login(self.owner)
        duplicate_sku = self.client.post(
            reverse("products_api:product-list"),
            self.product_payload(sku="milk-001", barcode="NEW-BARCODE"),
            content_type="application/json",
        )
        self.assertEqual(duplicate_sku.status_code, 400)
        self.assertIn("sku", duplicate_sku.json()["errors"])

        duplicate_barcode = self.client.post(
            reverse("products_api:product-list"),
            self.product_payload(sku="NEW-SKU", barcode=self.milk.barcode),
            content_type="application/json",
        )
        self.assertEqual(duplicate_barcode.status_code, 400)
        self.assertIn("barcode", duplicate_barcode.json()["errors"])

        self.assertEqual(self.other_milk.sku, self.milk.sku)
        self.assertEqual(self.other_milk.barcode, self.milk.barcode)

    def test_empty_barcode_is_normalized_to_null(self):
        self.login(self.owner)
        response = self.client.post(
            reverse("products_api:product-list"),
            self.product_payload(sku="NO-BARCODE", barcode="  "),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        product = Product.objects.get(pk=response.json()["data"]["id"])
        self.assertIsNone(product.barcode)

    def test_cross_shop_category_and_shop_input_are_rejected(self):
        self.login(self.owner)
        cross_category = self.client.post(
            reverse("products_api:product-list"),
            self.product_payload(category_id=str(self.other_category.id)),
            content_type="application/json",
        )
        self.assertEqual(cross_category.status_code, 400)
        self.assertIn("category_id", cross_category.json()["errors"])

        supplied_shop = self.client.post(
            reverse("products_api:product-list"),
            self.product_payload(shop_id=str(self.other_shop.id)),
            content_type="application/json",
        )
        self.assertEqual(supplied_shop.status_code, 400)
        self.assertIn("shop_id", supplied_shop.json()["errors"])

    def test_invalid_prices_and_tax_rate_are_rejected(self):
        self.login(self.owner)
        for field, value in (
            ("purchase_price", "-0.01"),
            ("selling_price", "-0.01"),
            ("tax_rate", "-0.01"),
            ("tax_rate", "100.01"),
        ):
            with self.subTest(field=field, value=value):
                response = self.client.post(
                    reverse("products_api:product-list"),
                    self.product_payload(
                        sku=f"INVALID-{field}-{value}",
                        barcode=None,
                        **{field: value},
                    ),
                    content_type="application/json",
                )
                self.assertEqual(response.status_code, 400)
                self.assertIn(field, response.json()["errors"])

    def test_search_and_filters(self):
        self.login(self.owner)
        url = reverse("products_api:product-list")
        for term in ("Almarai", "MILK-001", "6281007023412"):
            with self.subTest(term=term):
                response = self.client.get(url, {"search": term})
                self.assertEqual(response.json()["data"]["count"], 1)
                self.assertEqual(
                    response.json()["data"]["results"][0]["id"],
                    str(self.milk.id),
                )

        category_response = self.client.get(
            url,
            {"category": str(self.beverages.id)},
        )
        self.assertEqual(category_response.json()["data"]["count"], 1)
        self.assertEqual(category_response.json()["data"]["results"][0]["id"], str(self.cola.id))

        inactive_response = self.client.get(url, {"is_active": "false"})
        self.assertEqual(inactive_response.json()["data"]["count"], 1)
        self.assertEqual(inactive_response.json()["data"]["results"][0]["id"], str(self.cola.id))

    def test_barcode_lookup_is_shop_scoped(self):
        self.login(self.owner)
        response = self.client.get(
            reverse("products_api:product-barcode", args=[self.milk.barcode])
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["id"], str(self.milk.id))

        isolated = self.client.get(
            reverse(
                "products_api:product-barcode",
                args=["OTHER-SHOP-ONLY"],
            )
        )
        self.assertEqual(isolated.status_code, 404)

        other_only = Product.objects.create(
            shop=self.other_shop,
            name="Other Barcode Product",
            sku="OTHER-BARCODE-SKU",
            barcode="OTHER-SHOP-ONLY",
            selling_price=Decimal("1.00"),
        )
        self.assertTrue(other_only.id)
        still_isolated = self.client.get(
            reverse(
                "products_api:product-barcode",
                args=["OTHER-SHOP-ONLY"],
            )
        )
        self.assertEqual(still_isolated.status_code, 404)
