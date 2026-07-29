from decimal import Decimal

from django.test import TestCase
from django.urls import reverse

from apps.accounts.models import User
from apps.inventory.models import InventoryBalance
from apps.shops.models import Shop

from .models import Product, ProductCategory

PASSWORD = "ManualProductEntry123!"


class ManualProductEntryTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.shop = Shop.objects.create(name="Catalogue Shop", address="Doha", phone="1")
        cls.other_shop = Shop.objects.create(name="Other Catalogue", address="Doha", phone="2")
        cls.owner = User.objects.create_user(
            shop=cls.shop, username="owner", password=PASSWORD,
            full_name="Owner", role=User.Role.OWNER,
        )
        cls.cashier = User.objects.create_user(
            shop=cls.shop, username="cashier", password=PASSWORD,
            full_name="Cashier",
        )
        cls.category = ProductCategory.objects.create(
            shop=cls.shop, name="Dairy"
        )

    def payload(self, **overrides):
        return {
            "name": "Fresh Milk",
            "description": "Local milk",
            "sku": " milk-001 ",
            "barcode": "",
            "unit": Product.Unit.BOTTLE,
            "purchase_price": "4.25",
            "selling_price": "6.50",
            "tax_rate": "0.00",
            "is_tax_inclusive": False,
            "is_active": True,
            "category_id": str(self.category.id),
            **overrides,
        }

    def create(self, user=None, **overrides):
        self.client.force_login(user or self.owner)
        return self.client.post(
            reverse("products_api:product-list"),
            self.payload(**overrides),
            content_type="application/json",
        )

    def test_manual_product_without_barcode_is_decimal_and_uninitialized(self):
        response = self.create()
        self.assertEqual(response.status_code, 201)
        product = Product.objects.get(shop=self.shop, sku="MILK-001")
        self.assertIsNone(product.barcode)
        self.assertEqual(product.purchase_price, Decimal("4.25"))
        self.assertEqual(product.selling_price, Decimal("6.50"))
        self.assertFalse(InventoryBalance.objects.filter(product=product).exists())

    def test_barcode_and_sku_uniqueness_are_shop_scoped(self):
        self.create(barcode=" 628100000001 ")
        duplicate_sku = self.create(name="Other", barcode="628100000002")
        duplicate_barcode = self.create(
            name="Other", sku="OTHER-1", barcode="628100000001"
        )
        self.assertEqual(duplicate_sku.status_code, 400)
        self.assertEqual(duplicate_barcode.status_code, 400)
        other_owner = User.objects.create_user(
            shop=self.other_shop, username="owner", password=PASSWORD,
            full_name="Other Owner", role=User.Role.OWNER,
        )
        self.client.force_login(other_owner)
        response = self.client.post(
            reverse("products_api:product-list"),
            self.payload(
                category_id=None, name="Other Shop Milk",
                sku="milk-001", barcode="628100000001",
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)

    def test_weighted_product_and_validation_permissions(self):
        weighted = self.create(
            name="Bananas", sku="BANANA-KG", unit=Product.Unit.KG,
            purchase_price="2.15", selling_price="3.75",
        )
        self.assertEqual(weighted.status_code, 201)
        self.assertEqual(weighted.json()["data"]["unit"], Product.Unit.KG)
        self.assertEqual(self.create(
            name="Bad", sku="BAD", purchase_price="-1.00"
        ).status_code, 400)
        self.assertEqual(self.create(
            user=self.cashier, name="Denied", sku="DENIED"
        ).status_code, 403)

    def test_client_cannot_choose_shop(self):
        response = self.create(shop_id=str(self.other_shop.id))
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Product.objects.filter(shop=self.other_shop).exists())
