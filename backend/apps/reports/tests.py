from datetime import timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.inventory.models import InventoryBalance
from apps.payments.models import Payment
from apps.products.models import Product
from apps.sales.models import Sale, SaleItem
from apps.shops.models import Shop


class DashboardApiTests(APITestCase):
    endpoint = "/api/v1/dashboard/"

    @classmethod
    def setUpTestData(cls):
        cls.shop = Shop.objects.create(
            name="Dashboard Grocery",
            address="Doha",
            phone="+974 5000 0000",
        )
        cls.other_shop = Shop.objects.create(
            name="Other Grocery",
            address="Doha",
            phone="+974 5000 0001",
        )
        cls.owner = User.objects.create_user(
            shop=cls.shop,
            username="owner",
            password="StrongPass123!",
            full_name="Owner One",
            role=User.Role.OWNER,
        )
        cls.cashier = User.objects.create_user(
            shop=cls.shop,
            username="cashier",
            password="StrongPass123!",
            full_name="Cashier One",
            role=User.Role.CASHIER,
        )
        cls.cashier_two = User.objects.create_user(
            shop=cls.shop,
            username="cashier-two",
            password="StrongPass123!",
            full_name="Cashier Two",
            role=User.Role.CASHIER,
        )
        cls.other_owner = User.objects.create_user(
            shop=cls.other_shop,
            username="owner",
            password="StrongPass123!",
            full_name="Other Owner",
            role=User.Role.OWNER,
        )
        cls.milk = Product.objects.create(
            shop=cls.shop,
            name="Milk",
            sku="MILK",
            selling_price=Decimal("6.00"),
            unit=Product.Unit.BOTTLE,
        )
        cls.rice = Product.objects.create(
            shop=cls.shop,
            name="Rice",
            sku="RICE",
            selling_price=Decimal("8.00"),
            unit=Product.Unit.KG,
        )
        cls.missing = Product.objects.create(
            shop=cls.shop,
            name="Missing Stock",
            sku="MISSING",
            selling_price=Decimal("2.00"),
        )
        cls.inactive = Product.objects.create(
            shop=cls.shop,
            name="Inactive",
            sku="INACTIVE",
            selling_price=Decimal("1.00"),
            is_active=False,
        )
        InventoryBalance.objects.create(
            shop=cls.shop,
            product=cls.milk,
            quantity_on_hand=Decimal("2.000"),
            low_stock_threshold=Decimal("3.000"),
        )
        InventoryBalance.objects.create(
            shop=cls.shop,
            product=cls.rice,
            quantity_on_hand=Decimal("0.000"),
            low_stock_threshold=Decimal("2.000"),
        )
        InventoryBalance.objects.create(
            shop=cls.shop,
            product=cls.inactive,
            quantity_on_hand=Decimal("0.000"),
            low_stock_threshold=Decimal("2.000"),
        )

    @classmethod
    def sale(
        cls,
        *,
        user,
        product=None,
        total="12.00",
        quantity="2.000",
        completed_at=None,
        methods=(("CASH", "12.00"),),
        status=Sale.Status.COMPLETED,
    ):
        product = product or cls.milk
        completed = completed_at or timezone.now()
        is_completed = status == Sale.Status.COMPLETED
        sale = Sale.objects.create(
            shop=user.shop,
            created_by=user,
            completed_by=user if is_completed else None,
            completed_at=completed if is_completed else None,
            sale_number=f"NXP-TEST-{Sale.objects.count() + 1:06d}" if is_completed else None,
            status=status,
            subtotal=Decimal(total),
            grand_total=Decimal(total),
            amount_received=Decimal(total) if is_completed else Decimal("0.00"),
        )
        SaleItem.objects.create(
            sale=sale,
            product=product,
            product_name=product.name,
            sku=product.sku,
            unit=product.unit,
            quantity=Decimal(quantity),
            unit_price=product.selling_price,
            tax_rate=Decimal("0.00"),
            is_tax_inclusive=False,
            tax_amount=Decimal("0.00"),
            line_subtotal=Decimal(total),
            line_total=Decimal(total),
        )
        if is_completed:
            for method, amount in methods:
                Payment.objects.create(
                    shop=user.shop,
                    sale=sale,
                    payment_method=method,
                    amount=Decimal(amount),
                    recorded_by=user,
                )
        return sale

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_unauthenticated_request_is_denied(self):
        self.assertEqual(self.client.get(self.endpoint).status_code, 401)

    def test_owner_summary_uses_completed_today_sales_and_allocated_payments(self):
        self.sale(
            user=self.cashier,
            total="12.00",
            quantity="2.000",
            methods=(("CASH", "5.00"), ("CARD", "7.00")),
        )
        self.sale(user=self.cashier_two, product=self.rice, total="8.00", quantity="1.500", methods=(("CARD", "8.00"),))
        self.sale(
            user=self.cashier,
            completed_at=timezone.now() - timedelta(days=1),
            total="99.00",
            methods=(("CASH", "99.00"),),
        )
        self.sale(user=self.cashier, status=Sale.Status.DRAFT)
        self.sale(user=self.cashier, status=Sale.Status.CANCELLED)

        self.authenticate(self.owner)
        data = self.client.get(self.endpoint).json()["data"]
        summary = data["summary"]
        self.assertEqual(summary["sales_total_today"], "20.00")
        self.assertEqual(summary["completed_sales_count_today"], 2)
        self.assertEqual(summary["average_sale_value_today"], "10.00")
        self.assertEqual(summary["items_sold_today"], "3.500")
        self.assertEqual(summary["cash_sales_total_today"], "5.00")
        self.assertEqual(summary["card_sales_total_today"], "15.00")
        self.assertEqual(summary["split_sales_total_today"], "12.00")
        self.assertEqual(summary["low_stock_count"], 1)
        self.assertEqual(summary["out_of_stock_count"], 1)
        self.assertEqual(summary["inventory_not_initialized_count"], 1)
        self.assertEqual(summary["active_product_count"], 3)

    def test_cashier_financial_data_is_own_only(self):
        own = self.sale(user=self.cashier, total="12.00")
        other = self.sale(user=self.cashier_two, total="50.00")
        self.authenticate(self.cashier)
        data = self.client.get(self.endpoint).json()["data"]
        self.assertEqual(data["role"], User.Role.CASHIER)
        self.assertEqual(data["summary"]["my_sales_total_today"], "12.00")
        self.assertNotIn("cash_sales_total_today", data["summary"])
        ids = {row["id"] for row in data["recent_sales"]}
        self.assertIn(str(own.id), ids)
        self.assertNotIn(str(other.id), ids)

    def test_owner_recent_sales_are_completed_newest_first_and_limited(self):
        for offset in range(7):
            self.sale(
                user=self.cashier,
                completed_at=timezone.now() - timedelta(minutes=offset),
            )
        self.authenticate(self.owner)
        rows = self.client.get(self.endpoint).json()["data"]["recent_sales"]
        self.assertEqual(len(rows), 5)
        self.assertGreater(rows[0]["completed_at"], rows[-1]["completed_at"])

    def test_inventory_alerts_exclude_inactive_products(self):
        self.authenticate(self.owner)
        data = self.client.get(self.endpoint).json()["data"]
        alerts = data["inventory_alerts"]
        self.assertEqual([row["sku"] for row in alerts["low_stock"]], ["MILK"])
        self.assertEqual([row["sku"] for row in alerts["out_of_stock"]], ["RICE"])
        self.assertEqual(
            [row["sku"] for row in alerts["not_initialized"]], ["MISSING"]
        )

    def test_top_products_aggregate_completed_snapshot_lines(self):
        self.sale(user=self.cashier, total="12.00", quantity="2.000")
        self.sale(user=self.cashier_two, total="18.00", quantity="3.000")
        self.authenticate(self.owner)
        top = self.client.get(self.endpoint).json()["data"]["top_products"]
        self.assertEqual(top[0]["product_name"], "Milk")
        self.assertEqual(top[0]["quantity_sold"], "5.000")
        self.assertEqual(top[0]["sales_total"], "30.00")

    def test_trend_has_seven_days_and_zero_days(self):
        self.sale(user=self.cashier, total="12.00")
        self.authenticate(self.owner)
        trend = self.client.get(self.endpoint).json()["data"]["sales_trend"]
        self.assertEqual(len(trend), 7)
        self.assertEqual(trend[-1]["sales_total"], "12.00")
        self.assertTrue(any(row["sales_total"] == "0.00" for row in trend[:-1]))

    def test_zero_payment_breakdown_and_invalid_timezone_fallback(self):
        self.shop.timezone = "Invalid/Timezone"
        self.shop.save(update_fields=["timezone"])
        self.authenticate(self.owner)
        data = self.client.get(self.endpoint).json()["data"]
        self.assertEqual(data["timezone"], "Asia/Qatar")
        self.assertEqual(
            data["payment_breakdown"],
            [
                {"method": "CASH", "amount": "0.00", "percentage": "0.00"},
                {"method": "CARD", "amount": "0.00", "percentage": "0.00"},
            ],
        )

    def test_other_shop_data_never_leaks(self):
        other_product = Product.objects.create(
            shop=self.other_shop,
            name="Other Product",
            sku="OTHER",
            selling_price=Decimal("100.00"),
        )
        self.sale(
            user=self.other_owner,
            product=other_product,
            total="100.00",
            quantity="1.000",
            methods=(("CASH", "100.00"),),
        )
        self.authenticate(self.owner)
        data = self.client.get(self.endpoint).json()["data"]
        self.assertEqual(data["summary"]["sales_total_today"], "0.00")
        self.assertEqual(data["recent_sales"], [])

# Create your tests here.
