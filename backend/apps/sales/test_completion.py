from decimal import Decimal

from django.db import connection
from django.urls import reverse
from django.test.utils import CaptureQueriesContext

from apps.inventory.models import InventoryBalance, StockMovement
from apps.payments.models import Payment

from .models import Sale, SaleItem
from .tests import DraftBillingApiTestCase


class SaleCompletionTests(DraftBillingApiTestCase):
    def create_sale_with_item(self, user=None, product=None, quantity="2.000"):
        response = self.create_draft(user or self.owner)
        sale_id = response.json()["data"]["id"]
        added = self.add_product(
            sale_id,
            product or self.exclusive,
            quantity,
        )
        self.assertEqual(added.status_code, 200)
        return sale_id

    def complete(self, sale_id, payload):
        return self.client.post(
            reverse("sales_api:draft-complete", args=[sale_id]),
            payload,
            content_type="application/json",
        )

    def test_owner_cash_exact_completion_deducts_stock_and_creates_audit(self):
        sale_id = self.create_sale_with_item(quantity="2.000")
        response = self.complete(
            sale_id,
            {
                "payments": [{"method": "CASH", "amount": "21.00"}],
                "amount_received": "21.00",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertEqual(data["status"], "COMPLETED")
        self.assertRegex(
            data["sale_number"],
            r"^NXP-[A-F0-9]{6}-\d{8}-\d{6}$",
        )
        self.assertEqual(data["completed_by"]["id"], str(self.owner.id))
        self.assertEqual(data["amount_received"], "21.00")
        self.assertEqual(data["change_due"], "0.00")
        self.assertEqual(data["payments"][0]["amount"], "21.00")

        balance = InventoryBalance.objects.get(product=self.exclusive)
        self.assertEqual(balance.quantity_on_hand, Decimal("18.000"))
        movement = StockMovement.objects.get(
            product=self.exclusive,
            movement_type=StockMovement.Type.SALE,
        )
        self.assertEqual(movement.quantity_before, Decimal("20.000"))
        self.assertEqual(movement.quantity_delta, Decimal("-2.000"))
        self.assertEqual(movement.quantity_after, Decimal("18.000"))
        self.assertEqual(movement.reference, data["sale_number"])

    def test_cash_change_and_card_reference(self):
        cash_id = self.create_sale_with_item()
        cash = self.complete(
            cash_id,
            {
                "payments": [{"method": "CASH", "amount": "21.00"}],
                "amount_received": "30.00",
            },
        )
        self.assertEqual(cash.json()["data"]["change_due"], "9.00")
        self.assertEqual(
            Payment.objects.get(sale_id=cash_id).amount,
            Decimal("21.00"),
        )

        card_id = self.create_sale_with_item(product=self.inclusive)
        card = self.complete(
            card_id,
            {
                "payments": [
                    {
                        "method": "CARD",
                        "amount": "20.00",
                        "reference": "POS-TERMINAL",
                    }
                ]
            },
        )
        self.assertEqual(card.status_code, 200)
        payment = Payment.objects.get(sale_id=card_id)
        self.assertEqual(payment.reference, "POS-TERMINAL")
        self.assertEqual(card.json()["data"]["amount_received"], "20.00")
        self.assertNotIn("card_number", card.json()["data"]["payments"][0])

    def test_split_cash_and_card_is_supported_without_revenue_overstatement(self):
        sale_id = self.create_sale_with_item()
        response = self.complete(
            sale_id,
            {
                "payments": [
                    {"method": "CASH", "amount": "10.00"},
                    {
                        "method": "CARD",
                        "amount": "11.00",
                        "reference": "TERMINAL-1",
                    },
                ],
                "amount_received": "20.00",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertEqual(data["change_due"], "10.00")
        self.assertEqual(data["amount_received"], "31.00")
        self.assertEqual(
            sum(Payment.objects.filter(sale_id=sale_id).values_list("amount", flat=True)),
            Decimal("21.00"),
        )

    def test_invalid_payment_allocations_leave_sale_and_inventory_unchanged(self):
        invalid_payloads = (
            {
                "payments": [{"method": "CASH", "amount": "20.00"}],
                "amount_received": "20.00",
            },
            {
                "payments": [{"method": "CASH", "amount": "22.00"}],
                "amount_received": "22.00",
            },
            {
                "payments": [{"method": "CASH", "amount": "21.00"}],
                "amount_received": "10.00",
            },
            {"payments": [{"method": "CARD", "amount": "0.00"}]},
            {"payments": [{"method": "CARD", "amount": "-1.00"}]},
        )
        for payload in invalid_payloads:
            sale_id = self.create_sale_with_item()
            with self.subTest(payload=payload):
                response = self.complete(sale_id, payload)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(Sale.objects.get(pk=sale_id).status, Sale.Status.DRAFT)
                self.assertFalse(Payment.objects.filter(sale_id=sale_id).exists())
                self.assertFalse(
                    StockMovement.objects.filter(
                        reference__isnull=False,
                        movement_type=StockMovement.Type.SALE,
                    ).exists()
                )

    def test_cashier_permissions_cross_shop_empty_cancelled_and_duplicate(self):
        own_id = self.create_sale_with_item(self.cashier)
        other_cashier_id = self.create_sale_with_item(self.other_cashier)
        other_shop_id = self.create_sale_with_item(
            self.other_owner,
            self.other_product,
        )
        self.login(self.cashier)
        payload = {
            "payments": [{"method": "CASH", "amount": "21.00"}],
            "amount_received": "21.00",
        }
        self.assertEqual(self.complete(own_id, payload).status_code, 200)
        self.assertEqual(self.complete(other_cashier_id, payload).status_code, 404)
        self.assertEqual(self.complete(other_shop_id, payload).status_code, 404)
        self.assertEqual(self.complete(own_id, payload).status_code, 400)

        empty = self.create_draft(self.cashier).json()["data"]["id"]
        self.assertEqual(self.complete(empty, payload).status_code, 400)
        cancelled = self.create_sale_with_item(self.cashier)
        self.client.post(reverse("sales_api:draft-cancel", args=[cancelled]))
        self.assertEqual(self.complete(cancelled, payload).status_code, 400)

    def test_completed_sale_cannot_be_reclassified_as_cancelled(self):
        sale_id = self.create_sale_with_item(self.cashier)
        self.login(self.cashier)
        payload = {
            "payments": [{"method": "CASH", "amount": "21.00"}],
            "amount_received": "21.00",
        }
        self.assertEqual(self.complete(sale_id, payload).status_code, 200)

        cancel = self.client.post(
            reverse("sales_api:draft-cancel", args=[sale_id]),
        )

        self.assertEqual(cancel.status_code, 404)
        sale = Sale.objects.get(pk=sale_id)
        self.assertEqual(sale.status, Sale.Status.COMPLETED)
        self.assertEqual(Payment.objects.filter(sale=sale).count(), 1)
        self.assertEqual(
            StockMovement.objects.filter(
                movement_type=StockMovement.Type.SALE,
                reference=sale.sale_number,
            ).count(),
            1,
        )

    def test_insufficient_stock_rolls_back_every_finalization_write(self):
        sale_id = self.create_sale_with_item(quantity="5.000")
        balance = InventoryBalance.objects.get(product=self.exclusive)
        balance.quantity_on_hand = Decimal("1.000")
        balance.save(update_fields=["quantity_on_hand"])
        response = self.complete(
            sale_id,
            {
                "payments": [{"method": "CASH", "amount": "52.50"}],
                "amount_received": "52.50",
            },
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Stock changed before payment", response.json()["errors"]["inventory"])
        self.assertEqual(Sale.objects.get(pk=sale_id).status, Sale.Status.DRAFT)
        self.assertEqual(
            InventoryBalance.objects.get(product=self.exclusive).quantity_on_hand,
            Decimal("1.000"),
        )
        self.assertFalse(Payment.objects.filter(sale_id=sale_id).exists())
        self.assertFalse(
            StockMovement.objects.filter(
                product=self.exclusive,
                movement_type=StockMovement.Type.SALE,
            ).exists()
        )

    def test_weighted_items_and_multiple_lines_create_one_movement_each(self):
        sale_id = self.create_sale_with_item(
            product=self.inclusive,
            quantity="1.250",
        )
        self.add_product(sale_id, self.exclusive, "1.000")
        response = self.complete(
            sale_id,
            {
                "payments": [{"method": "CARD", "amount": "23.00"}],
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            InventoryBalance.objects.get(product=self.inclusive).quantity_on_hand,
            Decimal("8.750"),
        )
        self.assertEqual(
            StockMovement.objects.filter(
                movement_type=StockMovement.Type.SALE,
                reference=response.json()["data"]["sale_number"],
            ).count(),
            2,
        )

    def test_server_recalculates_stored_line_and_sale_totals(self):
        sale_id = self.create_sale_with_item()
        SaleItem.objects.filter(sale_id=sale_id).update(
            line_subtotal=Decimal("1.00"),
            tax_amount=Decimal("0.00"),
            line_total=Decimal("1.00"),
        )
        Sale.objects.filter(pk=sale_id).update(grand_total=Decimal("1.00"))
        response = self.complete(
            sale_id,
            {
                "payments": [{"method": "CARD", "amount": "21.00"}],
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["subtotal"], "20.00")
        self.assertEqual(response.json()["data"]["tax_total"], "1.00")
        self.assertEqual(response.json()["data"]["grand_total"], "21.00")

    def test_sale_numbers_are_unique_and_increase_for_same_shop_day(self):
        ids = [self.create_sale_with_item(quantity="1.000") for _ in range(2)]
        numbers = []
        for sale_id in ids:
            response = self.complete(
                sale_id,
                {"payments": [{"method": "CARD", "amount": "10.50"}]},
            )
            numbers.append(response.json()["data"]["sale_number"])
        self.assertEqual(len(set(numbers)), 2)
        self.assertLess(numbers[0], numbers[1])


class SalesHistoryAndReceiptTests(DraftBillingApiTestCase):
    def create_sale_with_item(self, user=None, product=None, quantity="2.000"):
        response = self.create_draft(user or self.owner)
        sale_id = response.json()["data"]["id"]
        added = self.add_product(
            sale_id,
            product or self.exclusive,
            quantity,
        )
        self.assertEqual(added.status_code, 200)
        return sale_id

    def complete(self, sale_id, payload):
        return self.client.post(
            reverse("sales_api:draft-complete", args=[sale_id]),
            payload,
            content_type="application/json",
        )

    def setUp(self):
        self.sale_id = self.create_sale_with_item(self.cashier)
        response = self.complete(
            self.sale_id,
            {
                "payments": [
                    {
                        "method": "CARD",
                        "amount": "21.00",
                        "reference": "SAFE-REFERENCE",
                    }
                ]
            },
        )
        self.sale_number = response.json()["data"]["sale_number"]

    def test_owner_and_cashier_history_permissions_and_filters(self):
        self.login(self.cashier)
        response = self.client.get(
            reverse("sales_history_api:list"),
            {
                "search": self.sale_number[-6:],
                "payment_method": "CARD",
                "date_from": "2020-01-01",
                "date_to": "2099-12-31",
                "page_size": 1,
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["count"], 1)
        self.assertEqual(
            response.json()["data"]["results"][0]["sale_number"],
            self.sale_number,
        )

        self.login(self.other_cashier)
        self.assertEqual(
            self.client.get(reverse("sales_history_api:list")).json()["data"]["count"],
            0,
        )
        self.assertEqual(
            self.client.get(
                reverse("sales_history_api:detail", args=[self.sale_id])
            ).status_code,
            404,
        )

        self.login(self.owner)
        owner_response = self.client.get(
            reverse("sales_history_api:list"),
            {"created_by": str(self.cashier.id)},
        )
        self.assertEqual(owner_response.json()["data"]["count"], 1)

    def test_sales_history_rejects_reversed_date_range(self):
        self.login(self.owner)

        response = self.client.get(
            reverse("sales_history_api:list"),
            {"date_from": "2026-07-24", "date_to": "2026-07-20"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("date_to", response.json()["errors"])

    def test_sales_history_query_count_is_bounded_with_prefetched_rows(self):
        for _ in range(3):
            sale_id = self.create_sale_with_item(self.cashier, quantity="1.000")
            self.complete(
                sale_id,
                {"payments": [{"method": "CARD", "amount": "10.50"}]},
            )
        self.login(self.owner)

        with CaptureQueriesContext(connection) as queries:
            response = self.client.get(reverse("sales_history_api:list"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["count"], 4)
        self.assertLessEqual(len(queries), 10)

    def test_completed_detail_and_receipt_are_safe_and_frontend_ready(self):
        self.login(self.cashier)
        detail = self.client.get(
            reverse("sales_history_api:detail", args=[self.sale_id])
        )
        receipt = self.client.get(
            reverse("sales_history_api:receipt", args=[self.sale_id])
        )
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(receipt.status_code, 200)
        detail_data = detail.json()["data"]
        receipt_data = receipt.json()["data"]
        self.assertEqual(detail_data["sale_number"], self.sale_number)
        self.assertNotIn("purchase_price", str(detail_data))
        self.assertEqual(receipt_data["shop"]["name"], self.shop.name)
        self.assertEqual(receipt_data["sale"]["sale_number"], self.sale_number)
        self.assertNotIn("shop_id", str(receipt_data))

    def test_draft_cancelled_and_cross_shop_receipts_are_hidden(self):
        draft_id = self.create_draft(self.cashier).json()["data"]["id"]
        cancelled_id = self.create_sale_with_item(self.cashier)
        self.client.post(reverse("sales_api:draft-cancel", args=[cancelled_id]))
        for sale_id in (draft_id, cancelled_id):
            self.assertEqual(
                self.client.get(
                    reverse("sales_history_api:receipt", args=[sale_id])
                ).status_code,
                404,
            )
        self.login(self.other_owner)
        self.assertEqual(
            self.client.get(
                reverse("sales_history_api:receipt", args=[self.sale_id])
            ).status_code,
            404,
        )
