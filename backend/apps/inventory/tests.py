from decimal import Decimal

from django.db import IntegrityError, transaction
from django.test import TestCase
from django.urls import reverse

from apps.accounts.models import User
from apps.products.models import Product, ProductCategory
from apps.shops.models import Shop

from .models import InventoryBalance, StockMovement
from .services import adjust_inventory

PASSWORD = "InventoryFoundationPassword123!"


class InventoryApiTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.shop = Shop.objects.create(
            name="Inventory Grocery",
            address="Doha",
            phone="+974 5555 0401",
        )
        cls.other_shop = Shop.objects.create(
            name="Other Inventory Grocery",
            address="Al Wakrah",
            phone="+974 5555 0402",
        )
        cls.owner = User.objects.create_user(
            shop=cls.shop,
            username="inventory-owner",
            password=PASSWORD,
            full_name="Inventory Owner",
            role=User.Role.OWNER,
        )
        cls.cashier = User.objects.create_user(
            shop=cls.shop,
            username="inventory-cashier",
            password=PASSWORD,
            full_name="Inventory Cashier",
        )
        cls.other_owner = User.objects.create_user(
            shop=cls.other_shop,
            username="other-inventory-owner",
            password=PASSWORD,
            full_name="Other Owner",
            role=User.Role.OWNER,
        )
        cls.category = ProductCategory.objects.create(
            shop=cls.shop,
            name="Beverages",
        )
        cls.product = Product.objects.create(
            shop=cls.shop,
            category=cls.category,
            name="Mineral Water 1.5L",
            sku="WATER-001",
            barcode="1111111111111",
            unit=Product.Unit.BOTTLE,
            selling_price=Decimal("2.00"),
        )
        cls.zero_product = Product.objects.create(
            shop=cls.shop,
            category=cls.category,
            name="Cola 330ml",
            sku="COLA-INV-001",
            unit=Product.Unit.CAN,
            selling_price=Decimal("2.50"),
        )
        cls.inactive_product = Product.objects.create(
            shop=cls.shop,
            name="Inactive Product",
            sku="INACTIVE-INV",
            selling_price=Decimal("1.00"),
            is_active=False,
        )
        cls.other_product = Product.objects.create(
            shop=cls.other_shop,
            name="Other Product",
            sku="OTHER-INV",
            selling_price=Decimal("1.00"),
        )

    def login(self, user):
        self.client.force_login(user, backend="common.authentication.ShopModelBackend")

    def opening_url(self, product=None):
        return reverse(
            "inventory_api:opening-stock",
            args=[(product or self.product).id],
        )

    def adjust_url(self, product=None):
        return reverse(
            "inventory_api:adjust",
            args=[(product or self.product).id],
        )

    def initialize(
        self,
        product=None,
        *,
        quantity="20.000",
        threshold="5.000",
    ):
        self.login(self.owner)
        return self.client.post(
            self.opening_url(product),
            {
                "quantity": quantity,
                "low_stock_threshold": threshold,
                "reason": "Initial count",
            },
            content_type="application/json",
        )

    def adjust(self, movement_type, quantity, product=None):
        return self.client.post(
            self.adjust_url(product),
            {
                "movement_type": movement_type,
                "quantity": quantity,
                "reason": "Manual test",
                "reference": "TEST-001",
            },
            content_type="application/json",
        )


class OpeningStockTests(InventoryApiTestCase):
    def test_owner_initializes_opening_stock_and_audit_values(self):
        response = self.initialize()
        self.assertEqual(response.status_code, 201)
        balance = InventoryBalance.objects.get(product=self.product)
        movement = StockMovement.objects.get(product=self.product)
        self.assertEqual(balance.quantity_on_hand, Decimal("20.000"))
        self.assertEqual(balance.low_stock_threshold, Decimal("5.000"))
        self.assertEqual(balance.last_movement_at, movement.created_at)
        self.assertEqual(movement.movement_type, StockMovement.Type.OPENING)
        self.assertEqual(movement.quantity_before, Decimal("0.000"))
        self.assertEqual(movement.quantity_after, Decimal("20.000"))
        self.assertEqual(movement.created_by, self.owner)

    def test_zero_opening_stock_is_valid_and_out_of_stock(self):
        response = self.initialize(
            self.zero_product,
            quantity="0.000",
            threshold="0.000",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            response.json()["data"]["inventory"]["stock_status"],
            "OUT_OF_STOCK",
        )

    def test_duplicate_opening_stock_is_rejected_without_extra_movement(self):
        self.initialize()
        response = self.initialize()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(StockMovement.objects.filter(product=self.product).count(), 1)

    def test_invalid_opening_values_are_rejected(self):
        self.login(self.owner)
        for field, payload in (
            (
                "quantity",
                {"quantity": "-1.000", "low_stock_threshold": "0.000"},
            ),
            (
                "low_stock_threshold",
                {"quantity": "0.000", "low_stock_threshold": "-1.000"},
            ),
        ):
            with self.subTest(field=field):
                response = self.client.post(
                    self.opening_url(),
                    payload,
                    content_type="application/json",
                )
                self.assertEqual(response.status_code, 400)
                self.assertIn(field, response.json()["errors"])
        self.assertFalse(InventoryBalance.objects.filter(product=self.product).exists())

    def test_one_balance_per_product_is_database_enforced(self):
        self.initialize()
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                InventoryBalance.objects.create(
                    shop=self.shop,
                    product=self.product,
                )

    def test_cashier_and_cross_shop_opening_stock_are_denied(self):
        self.login(self.cashier)
        denied = self.client.post(
            self.opening_url(),
            {"quantity": "1.000", "low_stock_threshold": "0.000"},
            content_type="application/json",
        )
        self.assertEqual(denied.status_code, 403)

        self.login(self.owner)
        isolated = self.client.post(
            self.opening_url(self.other_product),
            {"quantity": "1.000", "low_stock_threshold": "0.000"},
            content_type="application/json",
        )
        self.assertEqual(isolated.status_code, 404)


class AdjustmentTests(InventoryApiTestCase):
    def setUp(self):
        self.initialize()

    def test_each_manual_movement_uses_the_correct_sign(self):
        expected = Decimal("20.000")
        cases = (
            (StockMovement.Type.STOCK_IN, "2.000", Decimal("2.000")),
            (StockMovement.Type.STOCK_OUT, "1.000", Decimal("-1.000")),
            (StockMovement.Type.DAMAGE, "1.000", Decimal("-1.000")),
            (StockMovement.Type.EXPIRED, "1.000", Decimal("-1.000")),
            (StockMovement.Type.CORRECTION_IN, "3.000", Decimal("3.000")),
            (StockMovement.Type.CORRECTION_OUT, "2.000", Decimal("-2.000")),
        )
        for movement_type, quantity, delta in cases:
            with self.subTest(movement_type=movement_type):
                before = expected
                response = self.adjust(movement_type, quantity)
                self.assertEqual(response.status_code, 200)
                expected += delta
                movement = StockMovement.objects.latest("created_at")
                self.assertEqual(movement.quantity_delta, delta)
                self.assertEqual(movement.quantity_before, before)
                self.assertEqual(movement.quantity_after, expected)
        self.assertEqual(
            InventoryBalance.objects.get(product=self.product).quantity_on_hand,
            expected,
        )

    def test_zero_negative_and_insufficient_adjustments_are_atomic(self):
        starting_movements = StockMovement.objects.count()
        for quantity in ("0.000", "-1.000", "21.000"):
            with self.subTest(quantity=quantity):
                response = self.adjust(StockMovement.Type.STOCK_OUT, quantity)
                self.assertEqual(response.status_code, 400)
        balance = InventoryBalance.objects.get(product=self.product)
        self.assertEqual(balance.quantity_on_hand, Decimal("20.000"))
        self.assertEqual(StockMovement.objects.count(), starting_movements)

    def test_sequential_adjustments_use_current_persisted_balance(self):
        first = self.adjust(StockMovement.Type.STOCK_IN, "5.000")
        second = self.adjust(StockMovement.Type.STOCK_OUT, "3.500")
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        balance = InventoryBalance.objects.get(product=self.product)
        self.assertEqual(balance.quantity_on_hand, Decimal("21.500"))
        latest = StockMovement.objects.latest("created_at")
        self.assertEqual(latest.quantity_before, Decimal("25.000"))
        self.assertEqual(latest.quantity_after, Decimal("21.500"))
        self.assertEqual(latest.created_by, self.owner)
        self.assertEqual(balance.last_movement_at, latest.created_at)

    def test_cashier_and_cross_shop_adjustments_are_denied(self):
        self.login(self.cashier)
        denied = self.adjust(StockMovement.Type.STOCK_IN, "1.000")
        self.assertEqual(denied.status_code, 403)
        self.login(self.owner)
        isolated = self.adjust(
            StockMovement.Type.STOCK_IN,
            "1.000",
            self.other_product,
        )
        self.assertEqual(isolated.status_code, 404)

    def test_adjustment_requires_initialized_balance(self):
        response = self.adjust(
            StockMovement.Type.STOCK_IN,
            "1.000",
            self.zero_product,
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            StockMovement.objects.filter(product=self.zero_product).count(),
            0,
        )

    def test_service_updates_balance_and_movement_in_one_operation(self):
        balance, movement = adjust_inventory(
            product=self.product,
            created_by=self.owner,
            movement_type=StockMovement.Type.STOCK_IN,
            quantity=Decimal("2.250"),
        )
        self.assertEqual(balance.quantity_on_hand, movement.quantity_after)
        self.assertEqual(
            movement.quantity_after,
            movement.quantity_before + movement.quantity_delta,
        )


class InventoryListTests(InventoryApiTestCase):
    def setUp(self):
        self.initialize(quantity="5.000", threshold="5.000")
        self.initialize(
            self.zero_product,
            quantity="0.000",
            threshold="0.000",
        )

    def test_inventory_list_search_category_and_status_filters(self):
        url = reverse("inventory_api:list")
        for params, expected_id in (
            ({"search": "WATER-001"}, self.product.id),
            ({"category": str(self.category.id)}, self.product.id),
            ({"stock_status": "LOW_STOCK"}, self.product.id),
            ({"stock_status": "OUT_OF_STOCK"}, self.zero_product.id),
            ({"stock_status": "NOT_INITIALIZED"}, self.inactive_product.id),
        ):
            with self.subTest(params=params):
                response = self.client.get(url, params)
                ids = [item["product"]["id"] for item in response.json()["data"]["results"]]
                self.assertIn(str(expected_id), ids)

    def test_stock_status_rules_include_zero_threshold(self):
        self.login(self.owner)
        response = self.client.get(reverse("inventory_api:list"))
        statuses = {
            item["product"]["id"]: item["stock_status"]
            for item in response.json()["data"]["results"]
        }
        self.assertEqual(statuses[str(self.product.id)], "LOW_STOCK")
        self.assertEqual(statuses[str(self.zero_product.id)], "OUT_OF_STOCK")
        self.assertEqual(statuses[str(self.inactive_product.id)], "NOT_INITIALIZED")

        self.adjust(StockMovement.Type.STOCK_IN, "1.000", self.zero_product)
        detail = self.client.get(
            reverse("inventory_api:detail", args=[self.zero_product.id])
        )
        self.assertEqual(detail.json()["data"]["stock_status"], "IN_STOCK")

    def test_owner_sees_inactive_but_cashier_only_active(self):
        self.login(self.owner)
        owner_response = self.client.get(reverse("inventory_api:list"))
        owner_ids = {
            item["product"]["id"]
            for item in owner_response.json()["data"]["results"]
        }
        self.assertIn(str(self.inactive_product.id), owner_ids)

        self.login(self.cashier)
        cashier_response = self.client.get(reverse("inventory_api:list"))
        cashier_ids = {
            item["product"]["id"]
            for item in cashier_response.json()["data"]["results"]
        }
        self.assertNotIn(str(self.inactive_product.id), cashier_ids)

    def test_low_out_endpoints_detail_summary_and_shop_isolation(self):
        self.login(self.owner)
        low = self.client.get(reverse("inventory_api:low-stock"))
        out = self.client.get(reverse("inventory_api:out-of-stock"))
        detail = self.client.get(
            reverse("inventory_api:detail", args=[self.product.id])
        )
        summary = self.client.get(reverse("inventory_api:summary"))
        isolated = self.client.get(
            reverse("inventory_api:detail", args=[self.other_product.id])
        )
        self.assertEqual(low.json()["data"]["count"], 1)
        self.assertEqual(out.json()["data"]["count"], 1)
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(summary.json()["data"]["initialized"], 2)
        self.assertEqual(summary.json()["data"]["low_stock"], 1)
        self.assertEqual(summary.json()["data"]["out_of_stock"], 1)
        self.assertEqual(isolated.status_code, 404)

    def test_movement_history_is_ordered_paginated_read_only_and_safe(self):
        self.login(self.owner)
        self.adjust(StockMovement.Type.STOCK_IN, "1.000")
        response = self.client.get(
            reverse("inventory_api:movements", args=[self.product.id]),
            {"page_size": 1},
        )
        data = response.json()["data"]
        self.assertEqual(data["count"], 2)
        self.assertEqual(len(data["results"]), 1)
        movement = data["results"][0]
        self.assertEqual(movement["movement_type"], StockMovement.Type.STOCK_IN)
        self.assertEqual(
            set(movement["created_by"]),
            {"id", "full_name"},
        )
        self.assertNotIn("shop", movement)

    def test_cashier_can_read_active_product_movement_history(self):
        self.login(self.cashier)
        response = self.client.get(
            reverse("inventory_api:movements", args=[self.product.id])
        )
        self.assertEqual(response.status_code, 200)

    def test_owner_can_update_threshold_but_cashier_cannot(self):
        self.login(self.owner)
        url = reverse("inventory_api:detail", args=[self.product.id])
        updated = self.client.patch(
            url,
            {"low_stock_threshold": "2.500"},
            content_type="application/json",
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["data"]["low_stock_threshold"], "2.500")

        self.login(self.cashier)
        denied = self.client.patch(
            url,
            {"low_stock_threshold": "1.000"},
            content_type="application/json",
        )
        self.assertEqual(denied.status_code, 403)
