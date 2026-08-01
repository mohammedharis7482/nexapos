from decimal import Decimal

from django.urls import reverse

from .models import Sale
from .tests import DraftBillingApiTestCase


class DraftDiscountTests(DraftBillingApiTestCase):
    def discount_url(self, sale_id):
        return reverse("sales_api:draft-discount", args=[sale_id])

    def set_discount(self, sale_id, discount_type, discount_value):
        return self.client.put(
            self.discount_url(sale_id),
            {"discount_type": discount_type, "discount_value": discount_value},
            content_type="application/json",
        )

    def test_percentage_discount_reduces_grand_total(self):
        response = self.create_draft(self.owner)
        sale_id = response.json()["data"]["id"]
        # exclusive: 10.00 x 2 @ 5% tax => subtotal 20.00, tax 1.00, lines 21.00
        self.add_product(sale_id, self.exclusive, "2.000")

        discount_response = self.set_discount(sale_id, "PERCENTAGE", "10")
        self.assertEqual(discount_response.status_code, 200)
        data = discount_response.json()["data"]
        self.assertEqual(data["subtotal"], "20.00")
        self.assertEqual(data["tax_total"], "1.00")
        self.assertEqual(data["discount_type"], "PERCENTAGE")
        self.assertEqual(data["discount_value"], "10.00")
        # 10% of 20.00 subtotal = 2.00 discount
        self.assertEqual(data["discount_total"], "2.00")
        self.assertEqual(data["grand_total"], "19.00")

    def test_fixed_discount_reduces_grand_total(self):
        response = self.create_draft(self.owner)
        sale_id = response.json()["data"]["id"]
        self.add_product(sale_id, self.exclusive, "2.000")

        discount_response = self.set_discount(sale_id, "FIXED", "5.00")
        self.assertEqual(discount_response.status_code, 200)
        data = discount_response.json()["data"]
        self.assertEqual(data["discount_total"], "5.00")
        self.assertEqual(data["grand_total"], "16.00")

    def test_percentage_discount_over_100_is_rejected(self):
        response = self.create_draft(self.owner)
        sale_id = response.json()["data"]["id"]
        self.add_product(sale_id, self.exclusive, "1.000")

        discount_response = self.set_discount(sale_id, "PERCENTAGE", "150")
        self.assertEqual(discount_response.status_code, 400)
        sale = Sale.objects.get(pk=sale_id)
        self.assertEqual(sale.discount_type, Sale.DiscountType.NONE)
        self.assertEqual(sale.grand_total, Decimal("10.50"))

    def test_fixed_discount_over_subtotal_is_rejected(self):
        response = self.create_draft(self.owner)
        sale_id = response.json()["data"]["id"]
        self.add_product(sale_id, self.exclusive, "1.000")  # subtotal 10.00

        discount_response = self.set_discount(sale_id, "FIXED", "50.00")
        self.assertEqual(discount_response.status_code, 400)
        sale = Sale.objects.get(pk=sale_id)
        self.assertEqual(sale.discount_type, Sale.DiscountType.NONE)

    def test_discount_never_exceeds_subtotal_after_items_shrink(self):
        response = self.create_draft(self.owner)
        sale_id = response.json()["data"]["id"]
        added = self.add_product(sale_id, self.exclusive, "2.000")  # subtotal 20.00
        item_id = added.json()["data"]["items"][0]["id"]

        discount_response = self.set_discount(sale_id, "FIXED", "18.00")
        self.assertEqual(discount_response.status_code, 200)
        self.assertEqual(discount_response.json()["data"]["discount_total"], "18.00")

        # Shrink the cart to a single unit (subtotal drops to 10.00); the
        # persisted 18.00 fixed discount must clamp down, never go negative.
        shrink = self.client.patch(
            reverse("sales_api:draft-item-detail", args=[sale_id, item_id]),
            {"quantity": "1.000"},
            content_type="application/json",
        )
        self.assertEqual(shrink.status_code, 200)
        data = shrink.json()["data"]
        self.assertEqual(data["subtotal"], "10.00")
        self.assertEqual(data["discount_total"], "10.00")
        self.assertEqual(data["grand_total"], "0.50")  # tax only, never negative

    def test_discount_zero_value_clears_discount(self):
        response = self.create_draft(self.owner)
        sale_id = response.json()["data"]["id"]
        self.add_product(sale_id, self.exclusive, "1.000")
        self.set_discount(sale_id, "FIXED", "5.00")

        cleared = self.set_discount(sale_id, "NONE", "0.00")
        self.assertEqual(cleared.status_code, 200)
        data = cleared.json()["data"]
        self.assertEqual(data["discount_type"], "NONE")
        self.assertEqual(data["discount_total"], "0.00")
        self.assertEqual(data["grand_total"], "10.50")

    def test_discount_persists_through_completion(self):
        response = self.create_draft(self.owner)
        sale_id = response.json()["data"]["id"]
        self.add_product(sale_id, self.exclusive, "2.000")
        self.set_discount(sale_id, "PERCENTAGE", "10")

        complete = self.client.post(
            reverse("sales_api:draft-complete", args=[sale_id]),
            {"payments": [{"method": "CASH", "amount": "19.00"}], "amount_received": "19.00"},
            content_type="application/json",
        )
        self.assertEqual(complete.status_code, 200)
        data = complete.json()["data"]
        self.assertEqual(data["discount_type"], "PERCENTAGE")
        self.assertEqual(data["discount_value"], "10.00")
        self.assertEqual(data["discount_total"], "2.00")
        self.assertEqual(data["grand_total"], "19.00")

        detail = self.client.get(reverse("sales_history_api:detail", args=[sale_id]))
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json()["data"]["discount_total"], "2.00")

    def test_discount_cannot_be_set_on_a_non_draft_sale(self):
        response = self.create_draft(self.owner)
        sale_id = response.json()["data"]["id"]
        self.add_product(sale_id, self.exclusive, "1.000")
        self.client.post(reverse("sales_api:draft-cancel", args=[sale_id]))

        discount_response = self.set_discount(sale_id, "FIXED", "1.00")
        self.assertEqual(discount_response.status_code, 400)

    def test_cashier_can_set_discount_on_own_draft(self):
        response = self.create_draft(self.cashier)
        sale_id = response.json()["data"]["id"]
        self.add_product(sale_id, self.exclusive, "1.000")

        discount_response = self.set_discount(sale_id, "FIXED", "1.00")
        self.assertEqual(discount_response.status_code, 200)

    def test_discount_is_shop_scoped(self):
        response = self.create_draft(self.other_owner)
        sale_id = response.json()["data"]["id"]
        self.add_product(sale_id, self.other_product, "1.000")

        self.login(self.owner)
        discount_response = self.set_discount(sale_id, "FIXED", "1.00")
        self.assertEqual(discount_response.status_code, 404)
