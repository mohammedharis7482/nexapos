from decimal import Decimal

from django.test import TestCase
from django.urls import reverse

from apps.accounts.models import User
from apps.inventory.models import InventoryBalance, StockMovement
from apps.products.models import Product
from apps.shops.models import Shop

from .calculations import calculate_line_totals
from .models import CashierShift, Sale, SaleItem

PASSWORD = "DraftBillingPassword123!"


class DraftBillingApiTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.shop = Shop.objects.create(
            name="Billing Grocery",
            address="Doha",
            phone="+974 5555 0601",
        )
        cls.other_shop = Shop.objects.create(
            name="Other Billing Grocery",
            address="Doha",
            phone="+974 5555 0602",
        )
        cls.owner = User.objects.create_user(
            shop=cls.shop,
            username="billing-owner",
            password=PASSWORD,
            full_name="Billing Owner",
            role=User.Role.OWNER,
        )
        cls.cashier = User.objects.create_user(
            shop=cls.shop,
            username="billing-cashier",
            password=PASSWORD,
            full_name="Billing Cashier",
        )
        cls.other_cashier = User.objects.create_user(
            shop=cls.shop,
            username="other-cashier",
            password=PASSWORD,
            full_name="Other Cashier",
        )
        cls.other_owner = User.objects.create_user(
            shop=cls.other_shop,
            username="other-billing-owner",
            password=PASSWORD,
            full_name="Other Billing Owner",
            role=User.Role.OWNER,
        )
        cls.exclusive = Product.objects.create(
            shop=cls.shop,
            name="Tax Exclusive Product",
            sku="BILL-EXCLUSIVE",
            barcode="2000000000001",
            unit=Product.Unit.PIECE,
            selling_price=Decimal("10.00"),
            tax_rate=Decimal("5.00"),
            is_tax_inclusive=False,
        )
        cls.inclusive = Product.objects.create(
            shop=cls.shop,
            name="Tax Inclusive Product",
            sku="BILL-INCLUSIVE",
            barcode="2000000000002",
            unit=Product.Unit.KG,
            selling_price=Decimal("10.00"),
            tax_rate=Decimal("5.00"),
            is_tax_inclusive=True,
        )
        cls.inactive = Product.objects.create(
            shop=cls.shop,
            name="Inactive Billing Product",
            sku="BILL-INACTIVE",
            selling_price=Decimal("2.00"),
            is_active=False,
        )
        cls.uninitialized = Product.objects.create(
            shop=cls.shop,
            name="Uninitialized Product",
            sku="BILL-NO-STOCK",
            selling_price=Decimal("3.00"),
        )
        cls.other_product = Product.objects.create(
            shop=cls.other_shop,
            name="Other Shop Product",
            sku="OTHER-BILLING",
            selling_price=Decimal("4.00"),
        )
        for product, quantity in (
            (cls.exclusive, "20.000"),
            (cls.inclusive, "10.000"),
            (cls.inactive, "5.000"),
            (cls.other_product, "10.000"),
        ):
            InventoryBalance.objects.create(
                shop=product.shop,
                product=product,
                quantity_on_hand=Decimal(quantity),
            )
        for user in (cls.owner, cls.cashier, cls.other_cashier, cls.other_owner):
            CashierShift.objects.create(
                shop=user.shop, cashier=user, opened_by=user,
                opening_cash=Decimal("100.00"),
            )

    def login(self, user):
        self.client.force_login(user, backend="common.authentication.ShopModelBackend")

    def create_draft(self, user=None):
        self.login(user or self.owner)
        return self.client.post(
            reverse("sales_api:draft-list"),
            {},
            content_type="application/json",
        )

    def add_url(self, sale_id):
        return reverse("sales_api:draft-item-create", args=[sale_id])

    def add_product(self, sale_id, product=None, quantity="1.000", **extra):
        payload = {
            "product_id": str((product or self.exclusive).id),
            "quantity": quantity,
            **extra,
        }
        return self.client.post(
            self.add_url(sale_id),
            payload,
            content_type="application/json",
        )


class DraftSaleTests(DraftBillingApiTestCase):
    def test_owner_and_cashier_create_empty_zero_total_drafts(self):
        for user in (self.owner, self.cashier):
            with self.subTest(role=user.role):
                response = self.create_draft(user)
                self.assertEqual(response.status_code, 201)
                data = response.json()["data"]
                self.assertEqual(data["status"], "DRAFT")
                self.assertEqual(data["items"], [])
                self.assertEqual(data["subtotal"], "0.00")
                self.assertEqual(data["tax_total"], "0.00")
                self.assertEqual(data["grand_total"], "0.00")
                self.assertEqual(data["currency"], "QAR")

    def test_owner_sees_all_shop_drafts_cashier_only_own(self):
        owner_draft = self.create_draft(self.owner).json()["data"]["id"]
        cashier_draft = self.create_draft(self.cashier).json()["data"]["id"]
        self.login(self.cashier)
        response = self.client.get(reverse("sales_api:draft-list"))
        ids = [draft["id"] for draft in response.json()["data"]["results"]]
        self.assertEqual(ids, [cashier_draft])
        self.assertNotIn(owner_draft, ids)

        self.login(self.owner)
        owner_response = self.client.get(reverse("sales_api:draft-list"))
        self.assertEqual(owner_response.json()["data"]["count"], 2)

    def test_cashier_cannot_access_other_cashier_or_other_shop_draft(self):
        own_draft = self.create_draft(self.cashier).json()["data"]["id"]
        other_draft = self.create_draft(self.other_cashier).json()["data"]["id"]
        other_shop_draft = self.create_draft(self.other_owner).json()["data"]["id"]
        self.login(self.cashier)
        self.assertEqual(
            self.client.get(
                reverse("sales_api:draft-detail", args=[own_draft])
            ).status_code,
            200,
        )
        for sale_id in (other_draft, other_shop_draft):
            self.assertEqual(
                self.client.get(
                    reverse("sales_api:draft-detail", args=[sale_id])
                ).status_code,
                404,
            )


class DraftItemTests(DraftBillingApiTestCase):
    def setUp(self):
        self.sale_id = self.create_draft().json()["data"]["id"]

    def test_add_by_product_id_and_barcode_and_repeat_increases_quantity(self):
        first = self.add_product(self.sale_id, quantity="1.250")
        self.assertEqual(first.status_code, 200)
        repeated = self.add_product(self.sale_id, quantity="0.750")
        self.assertEqual(repeated.json()["data"]["items"][0]["quantity"], "2.000")
        barcode = self.client.post(
            self.add_url(self.sale_id),
            {"barcode": self.inclusive.barcode, "quantity": "1.500"},
            content_type="application/json",
        )
        self.assertEqual(barcode.status_code, 200)
        self.assertEqual(len(barcode.json()["data"]["items"]), 2)

    def test_stock_and_product_safety_rejections_create_no_movement(self):
        movement_count = StockMovement.objects.count()
        cases = (
            (self.inactive, "1.000"),
            (self.uninitialized, "1.000"),
            (self.other_product, "1.000"),
            (self.exclusive, "21.000"),
        )
        for product, quantity in cases:
            with self.subTest(product=product.sku):
                response = self.add_product(
                    self.sale_id,
                    product,
                    quantity,
                )
                self.assertIn(response.status_code, (400, 404))
        self.assertEqual(SaleItem.objects.count(), 0)
        self.assertEqual(StockMovement.objects.count(), movement_count)

    def test_client_prices_totals_and_shop_fields_are_rejected(self):
        for field in (
            "unit_price",
            "tax_rate",
            "line_total",
            "subtotal",
            "shop_id",
            "created_by",
        ):
            with self.subTest(field=field):
                response = self.add_product(
                    self.sale_id,
                    **{field: "999.00"},
                )
                self.assertEqual(response.status_code, 400)
                self.assertIn(field, response.json()["errors"])

    def test_update_decimal_quantity_zero_rejection_and_remove(self):
        added = self.add_product(self.sale_id, quantity="2.000").json()["data"]
        item_id = added["items"][0]["id"]
        url = reverse(
            "sales_api:draft-item-detail",
            args=[self.sale_id, item_id],
        )
        updated = self.client.patch(
            url,
            {"quantity": "3.125"},
            content_type="application/json",
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["data"]["items"][0]["quantity"], "3.125")
        zero = self.client.patch(
            url,
            {"quantity": "0.000"},
            content_type="application/json",
        )
        self.assertEqual(zero.status_code, 400)
        removed = self.client.delete(url)
        self.assertEqual(removed.status_code, 200)
        self.assertEqual(removed.json()["data"]["items"], [])
        self.assertEqual(removed.json()["data"]["grand_total"], "0.00")

    def test_snapshots_and_safe_response_do_not_follow_live_product_price(self):
        response = self.add_product(self.sale_id)
        item = response.json()["data"]["items"][0]
        self.assertEqual(item["unit_price"], "10.00")
        self.assertNotIn("purchase_price", item)
        self.assertNotIn("shop", response.json()["data"])
        self.exclusive.name = "Changed Product Name"
        self.exclusive.selling_price = Decimal("99.00")
        self.exclusive.save(update_fields=["name", "selling_price"])
        detail = self.client.get(
            reverse("sales_api:draft-detail", args=[self.sale_id])
        )
        snapshot = detail.json()["data"]["items"][0]
        self.assertEqual(snapshot["product"]["name"], "Tax Exclusive Product")
        self.assertEqual(snapshot["unit_price"], "10.00")

    def test_totals_are_server_calculated_for_multiple_lines(self):
        self.add_product(self.sale_id, self.exclusive, "2.000")
        response = self.add_product(self.sale_id, self.inclusive, "2.000")
        data = response.json()["data"]
        self.assertEqual(data["subtotal"], "39.05")
        self.assertEqual(data["tax_total"], "1.95")
        self.assertEqual(data["grand_total"], "41.00")
        self.assertEqual(
            Decimal(data["grand_total"]),
            sum(Decimal(item["line_total"]) for item in data["items"]),
        )


class TaxCalculationTests(TestCase):
    def test_tax_exclusive_inclusive_quantity_and_rounding(self):
        exclusive = calculate_line_totals(
            quantity=Decimal("2.000"),
            unit_price=Decimal("10.00"),
            tax_rate=Decimal("5.00"),
            is_tax_inclusive=False,
        )
        self.assertEqual(exclusive.subtotal, Decimal("20.00"))
        self.assertEqual(exclusive.tax, Decimal("1.00"))
        self.assertEqual(exclusive.total, Decimal("21.00"))

        inclusive = calculate_line_totals(
            quantity=Decimal("2.000"),
            unit_price=Decimal("10.00"),
            tax_rate=Decimal("5.00"),
            is_tax_inclusive=True,
        )
        self.assertEqual(inclusive.subtotal, Decimal("19.05"))
        self.assertEqual(inclusive.tax, Decimal("0.95"))
        self.assertEqual(inclusive.total, Decimal("20.00"))

        rounded = calculate_line_totals(
            quantity=Decimal("1.005"),
            unit_price=Decimal("1.00"),
            tax_rate=Decimal("0.00"),
            is_tax_inclusive=False,
        )
        self.assertEqual(rounded.total, Decimal("1.01"))


class DraftCancellationTests(DraftBillingApiTestCase):
    def setUp(self):
        self.sale_id = self.create_draft(self.cashier).json()["data"]["id"]
        self.add_product(self.sale_id)

    def test_cashier_cancels_own_draft_repeatedly_and_items_remain(self):
        url = reverse("sales_api:draft-cancel", args=[self.sale_id])
        first = self.client.post(url)
        second = self.client.post(url)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        sale = Sale.objects.get(pk=self.sale_id)
        self.assertEqual(sale.status, Sale.Status.CANCELLED)
        self.assertEqual(sale.cancelled_by, self.cashier)
        self.assertIsNotNone(sale.cancelled_at)
        self.assertEqual(sale.items.count(), 1)

    def test_cancelled_draft_cannot_be_edited(self):
        self.client.post(reverse("sales_api:draft-cancel", args=[self.sale_id]))
        response = self.add_product(self.sale_id)
        self.assertEqual(response.status_code, 400)
        self.assertIn("status", response.json()["errors"])

    def test_cashier_cannot_cancel_other_draft_but_owner_can(self):
        other_id = self.create_draft(self.other_cashier).json()["data"]["id"]
        self.login(self.cashier)
        denied = self.client.post(
            reverse("sales_api:draft-cancel", args=[other_id])
        )
        self.assertEqual(denied.status_code, 404)
        self.login(self.owner)
        allowed = self.client.post(
            reverse("sales_api:draft-cancel", args=[other_id])
        )
        self.assertEqual(allowed.status_code, 200)


class HoldResumeDraftTests(DraftBillingApiTestCase):
    """hold_draft_sale/resume_held_sale and their views/URLs had zero
    references anywhere in the test suite before this."""

    def test_owner_holds_and_resumes_a_draft(self):
        sale_id = self.create_draft(self.owner).json()["data"]["id"]
        self.add_product(sale_id, quantity="2.000")

        held = self.client.post(
            reverse("sales_api:draft-hold", args=[sale_id]),
            {"note": "Customer stepped out"},
            content_type="application/json",
        )
        self.assertEqual(held.status_code, 200)
        self.assertEqual(held.json()["data"]["status"], "HELD")
        self.assertIsNotNone(Sale.objects.get(pk=sale_id).held_at)

        resumed = self.client.post(reverse("sales_api:draft-resume", args=[sale_id]))
        self.assertEqual(resumed.status_code, 200)
        self.assertEqual(resumed.json()["data"]["status"], "DRAFT")

    def test_only_a_held_bill_can_be_resumed(self):
        sale_id = self.create_draft(self.owner).json()["data"]["id"]
        response = self.client.post(reverse("sales_api:draft-resume", args=[sale_id]))
        self.assertEqual(response.status_code, 400)
        self.assertIn("status", response.json()["errors"])

    def test_resuming_rejects_a_bill_with_a_since_deactivated_product(self):
        sale_id = self.create_draft(self.owner).json()["data"]["id"]
        self.add_product(sale_id, product=self.exclusive, quantity="1.000")
        self.client.post(reverse("sales_api:draft-hold", args=[sale_id]))
        self.exclusive.is_active = False
        self.exclusive.save(update_fields=["is_active", "updated_at"])

        response = self.client.post(reverse("sales_api:draft-resume", args=[sale_id]))
        self.assertEqual(response.status_code, 400)
        self.assertIn("items", response.json()["errors"])

    def test_cashier_cannot_hold_or_resume_another_cashiers_draft(self):
        # Unlike DraftCancelView, DraftHoldView/DraftResumeView don't
        # pre-check via sale_for_request()/get_object_or_404 - denial comes
        # from hold_draft_sale()/resume_held_sale() raising
        # BillingOperationError("sale_id", ...), which the view maps to a
        # 400 ValidationError, not a 404.
        other_id = self.create_draft(self.other_cashier).json()["data"]["id"]
        self.add_product(other_id, quantity="1.000")
        self.login(self.cashier)
        denied_hold = self.client.post(
            reverse("sales_api:draft-hold", args=[other_id])
        )
        self.assertEqual(denied_hold.status_code, 400)
        self.assertIn("sale_id", denied_hold.json()["errors"])

        self.login(self.other_cashier)
        self.client.post(reverse("sales_api:draft-hold", args=[other_id]))
        self.login(self.cashier)
        denied_resume = self.client.post(
            reverse("sales_api:draft-resume", args=[other_id])
        )
        self.assertEqual(denied_resume.status_code, 400)
        self.assertIn("sale_id", denied_resume.json()["errors"])


class ShiftApiTests(DraftBillingApiTestCase):
    """OpenShiftView/CurrentShiftView/CloseShiftView/ShiftListView/
    ShiftDetailView had zero test coverage before this - permission and
    shop/cashier scoping on financial reconciliation data was unverified.
    setUpTestData already opens one shift per fixture user (owner,
    cashier, other_cashier, other_owner)."""

    def open_url(self):
        return reverse("shift_api:open")

    def close_url(self, shift_id):
        return reverse("shift_api:close", args=[shift_id])

    def detail_url(self, shift_id):
        return reverse("shift_api:detail", args=[shift_id])

    def test_cashier_sees_only_their_own_shift_in_the_list(self):
        self.login(self.cashier)
        response = self.client.get(reverse("shift_api:list"))
        self.assertEqual(response.status_code, 200)
        cashier_ids = {row["cashier"]["id"] for row in response.json()["data"]["results"]}
        self.assertEqual(cashier_ids, {str(self.cashier.id)})

    def test_owner_sees_every_shift_in_the_shop_in_the_list(self):
        self.login(self.owner)
        response = self.client.get(reverse("shift_api:list"))
        self.assertEqual(response.status_code, 200)
        cashier_ids = {row["cashier"]["id"] for row in response.json()["data"]["results"]}
        self.assertEqual(cashier_ids, {str(self.owner.id), str(self.cashier.id), str(self.other_cashier.id)})
        self.assertNotIn(str(self.other_owner.id), cashier_ids)

    def test_cashier_cannot_view_another_cashiers_shift_detail(self):
        other_shift = CashierShift.objects.get(cashier=self.other_cashier)
        self.login(self.cashier)
        response = self.client.get(self.detail_url(other_shift.id))
        self.assertEqual(response.status_code, 404)

    def test_owner_can_view_a_cashiers_shift_detail_but_not_another_shops(self):
        cashier_shift = CashierShift.objects.get(cashier=self.cashier)
        other_shop_shift = CashierShift.objects.get(cashier=self.other_owner)
        self.login(self.owner)
        own_shop = self.client.get(self.detail_url(cashier_shift.id))
        self.assertEqual(own_shop.status_code, 200)
        cross_shop = self.client.get(self.detail_url(other_shop_shift.id))
        self.assertEqual(cross_shop.status_code, 404)

    def test_opening_a_second_shift_while_one_is_already_open_is_rejected(self):
        self.login(self.owner)
        response = self.client.post(
            self.open_url(), {"opening_cash": "50.00"}, content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("status", response.json()["errors"])

    def test_negative_opening_cash_is_rejected(self):
        self.login(self.owner)
        response = self.client.post(
            self.open_url(), {"opening_cash": "-10.00"}, content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_negative_counted_closing_cash_is_rejected(self):
        shift = CashierShift.objects.get(cashier=self.owner)
        self.login(self.owner)
        response = self.client.post(
            self.close_url(shift.id),
            {"counted_closing_cash": "-1.00"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_cashier_cannot_close_another_cashiers_shift(self):
        other_shift = CashierShift.objects.get(cashier=self.other_cashier)
        self.login(self.cashier)
        response = self.client.post(
            self.close_url(other_shift.id),
            {"counted_closing_cash": "100.00"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("shift", response.json()["errors"])

    def test_owner_closes_own_shift_successfully(self):
        shift = CashierShift.objects.get(cashier=self.owner)
        self.login(self.owner)
        response = self.client.post(
            self.close_url(shift.id),
            {"counted_closing_cash": "100.00"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["status"], "CLOSED")
