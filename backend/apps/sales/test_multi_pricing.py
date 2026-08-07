"""Multi-pricing (packet + loose) sales against one shared stock pool."""

from decimal import Decimal

from django.test import TestCase
from django.urls import reverse

from apps.accounts.models import User
from apps.inventory.models import InventoryBalance, StockMovement
from apps.products.models import Product, ProductPacket
from apps.sales.exceptions import BillingOperationError
from apps.sales.models import Sale, SaleItem
from apps.sales.services import (
    add_product_to_draft,
    complete_sale,
    create_draft_sale,
    open_shift,
    resume_held_sale,
    hold_draft_sale,
    update_draft_item_quantity,
)
from apps.shops.models import Shop

PASSWORD = "MultiPricingPassword123!"


class MultiPricingTestBase(TestCase):
    def setUp(self):
        self.shop = Shop.objects.create(
            name="Multi Pricing Grocery",
            address="Doha",
            phone="+97450009301",
            status=Shop.Status.ACTIVE,
        )
        self.owner = User.objects.create_user(
            shop=self.shop,
            username="mp_owner",
            password=PASSWORD,
            full_name="Multi Owner",
            role=User.Role.OWNER,
        )
        # Rice priced 12.00 per KG loose, stocked as 10 KG in one pool.
        self.rice = Product.objects.create(
            shop=self.shop,
            name="Basmati Rice",
            sku="RICE-001",
            unit=Product.Unit.KG,
            selling_price=Decimal("12.00"),
            pricing_mode=Product.PricingMode.MULTI,
        )
        self.packet_250 = ProductPacket.objects.create(
            product=self.rice, size=Decimal("0.250"), price=Decimal("3.50"), display_order=0
        )
        self.packet_1kg = ProductPacket.objects.create(
            product=self.rice, size=Decimal("1.000"), price=Decimal("13.00"), display_order=1
        )
        self.balance = InventoryBalance.objects.create(
            shop=self.shop,
            product=self.rice,
            quantity_on_hand=Decimal("10.000"),
            low_stock_threshold=Decimal("1.000"),
        )
        open_shift(user=self.owner)

    def draft(self):
        return create_draft_sale(user=self.owner)

    def checkout(self, sale):
        sale.refresh_from_db()
        return complete_sale(
            sale_id=sale.pk,
            user=self.owner,
            payments=[{"method": "CASH", "amount": sale.grand_total}],
            amount_received=sale.grand_total,
        )

    def on_hand(self) -> Decimal:
        self.balance.refresh_from_db()
        return self.balance.quantity_on_hand


class PacketAndLooseDeductionTests(MultiPricingTestBase):
    def test_packet_sale_charges_the_packet_price_and_deducts_the_packet_size(self):
        sale = self.draft()
        add_product_to_draft(
            sale_id=sale.pk,
            user=self.owner,
            product_id=self.rice.pk,
            quantity=Decimal("2"),
            pricing_mode=SaleItem.PricingMode.PACKET,
            packet_id=self.packet_250.pk,
        )
        item = SaleItem.objects.get(sale=sale)
        # Charged per packet at the packet's exact price, never a derived
        # per-kilo rate that two decimals could not represent.
        self.assertEqual(item.quantity, Decimal("2.000"))
        self.assertEqual(item.unit_price, Decimal("3.50"))
        self.assertEqual(item.line_total, Decimal("7.00"))
        # Stock draws down in the product's own unit.
        self.assertEqual(item.stock_quantity, Decimal("0.500"))
        self.assertEqual(item.packet_size, Decimal("0.250"))

        self.checkout(sale)
        self.assertEqual(self.on_hand(), Decimal("9.500"))

    def test_loose_sale_charges_per_unit_and_deducts_the_entered_weight(self):
        sale = self.draft()
        add_product_to_draft(
            sale_id=sale.pk,
            user=self.owner,
            product_id=self.rice.pk,
            quantity=Decimal("0.750"),
            pricing_mode=SaleItem.PricingMode.LOOSE,
        )
        item = SaleItem.objects.get(sale=sale)
        self.assertEqual(item.quantity, Decimal("0.750"))
        self.assertEqual(item.stock_quantity, Decimal("0.750"))
        self.assertEqual(item.unit_price, Decimal("12.00"))
        self.assertEqual(item.line_total, Decimal("9.00"))
        self.assertIsNone(item.packet)

        self.checkout(sale)
        self.assertEqual(self.on_hand(), Decimal("9.250"))

    def test_packet_and_loose_lines_coexist_and_draw_on_the_same_pool(self):
        """The core invariant: stock never splits into two disconnected numbers."""
        sale = self.draft()
        add_product_to_draft(
            sale_id=sale.pk, user=self.owner, product_id=self.rice.pk,
            quantity=Decimal("2"),
            pricing_mode=SaleItem.PricingMode.PACKET, packet_id=self.packet_250.pk,
        )
        add_product_to_draft(
            sale_id=sale.pk, user=self.owner, product_id=self.rice.pk,
            quantity=Decimal("0.750"), pricing_mode=SaleItem.PricingMode.LOOSE,
        )
        # Two separate lines for one product - the old (sale, product)
        # uniqueness would have merged these into one wrong line.
        self.assertEqual(SaleItem.objects.filter(sale=sale).count(), 2)

        sale.refresh_from_db()
        self.assertEqual(sale.grand_total, Decimal("16.00"))  # 7.00 + 9.00

        self.checkout(sale)
        # 0.500 from packets + 0.750 loose, out of one 10.000 pool.
        self.assertEqual(self.on_hand(), Decimal("8.750"))
        self.assertEqual(
            StockMovement.objects.filter(
                product=self.rice, movement_type=StockMovement.Type.SALE
            ).count(),
            2,
        )

    def test_mixed_sales_in_sequence_reduce_the_same_pool_cumulatively(self):
        first = self.draft()
        add_product_to_draft(
            sale_id=first.pk, user=self.owner, product_id=self.rice.pk,
            quantity=Decimal("1"),
            pricing_mode=SaleItem.PricingMode.PACKET, packet_id=self.packet_1kg.pk,
        )
        self.checkout(first)
        self.assertEqual(self.on_hand(), Decimal("9.000"))

        second = self.draft()
        add_product_to_draft(
            sale_id=second.pk, user=self.owner, product_id=self.rice.pk,
            quantity=Decimal("1.500"), pricing_mode=SaleItem.PricingMode.LOOSE,
        )
        self.checkout(second)
        self.assertEqual(self.on_hand(), Decimal("7.500"))

        third = self.draft()
        add_product_to_draft(
            sale_id=third.pk, user=self.owner, product_id=self.rice.pk,
            quantity=Decimal("3"),
            pricing_mode=SaleItem.PricingMode.PACKET, packet_id=self.packet_250.pk,
        )
        self.checkout(third)
        self.assertEqual(self.on_hand(), Decimal("6.750"))

    def test_same_packet_added_twice_merges_but_a_different_size_does_not(self):
        sale = self.draft()
        for _ in range(2):
            add_product_to_draft(
                sale_id=sale.pk, user=self.owner, product_id=self.rice.pk,
                quantity=Decimal("1"),
                pricing_mode=SaleItem.PricingMode.PACKET, packet_id=self.packet_250.pk,
            )
        add_product_to_draft(
            sale_id=sale.pk, user=self.owner, product_id=self.rice.pk,
            quantity=Decimal("1"),
            pricing_mode=SaleItem.PricingMode.PACKET, packet_id=self.packet_1kg.pk,
        )
        lines = SaleItem.objects.filter(sale=sale).order_by("packet__size")
        self.assertEqual(lines.count(), 2)
        self.assertEqual(lines[0].quantity, Decimal("2.000"))
        self.assertEqual(lines[0].stock_quantity, Decimal("0.500"))
        self.assertEqual(lines[1].quantity, Decimal("1.000"))
        self.assertEqual(lines[1].stock_quantity, Decimal("1.000"))

    def test_updating_a_packet_line_quantity_rescales_its_stock_draw(self):
        sale = self.draft()
        add_product_to_draft(
            sale_id=sale.pk, user=self.owner, product_id=self.rice.pk,
            quantity=Decimal("1"),
            pricing_mode=SaleItem.PricingMode.PACKET, packet_id=self.packet_250.pk,
        )
        item = SaleItem.objects.get(sale=sale)
        update_draft_item_quantity(
            sale_id=sale.pk, item_id=item.pk, user=self.owner, quantity=Decimal("4")
        )
        item.refresh_from_db()
        self.assertEqual(item.quantity, Decimal("4.000"))
        self.assertEqual(item.stock_quantity, Decimal("1.000"))
        self.assertEqual(item.line_total, Decimal("14.00"))


class MultiPricingStockRejectionTests(MultiPricingTestBase):
    def test_loose_weight_beyond_available_stock_is_rejected(self):
        sale = self.draft()
        with self.assertRaises(BillingOperationError) as caught:
            add_product_to_draft(
                sale_id=sale.pk, user=self.owner, product_id=self.rice.pk,
                quantity=Decimal("10.001"), pricing_mode=SaleItem.PricingMode.LOOSE,
            )
        self.assertEqual(caught.exception.field, "quantity")
        self.assertEqual(SaleItem.objects.filter(sale=sale).count(), 0)

    def test_packet_sale_is_rejected_when_the_pool_is_below_the_packet_size(self):
        self.balance.quantity_on_hand = Decimal("0.200")
        self.balance.save(update_fields=["quantity_on_hand"])
        sale = self.draft()
        with self.assertRaises(BillingOperationError) as caught:
            add_product_to_draft(
                sale_id=sale.pk, user=self.owner, product_id=self.rice.pk,
                quantity=Decimal("1"),
                pricing_mode=SaleItem.PricingMode.PACKET, packet_id=self.packet_250.pk,
            )
        self.assertEqual(caught.exception.field, "quantity")

    def test_packet_and_loose_lines_are_judged_against_their_combined_demand(self):
        """Each line fits on its own; together they overdraw the shared pool.

        Checking availability line-by-line would let this through - the whole
        reason demand is summed per product before it meets the balance.
        """
        self.balance.quantity_on_hand = Decimal("1.000")
        self.balance.save(update_fields=["quantity_on_hand"])
        sale = self.draft()
        add_product_to_draft(
            sale_id=sale.pk, user=self.owner, product_id=self.rice.pk,
            quantity=Decimal("0.800"), pricing_mode=SaleItem.PricingMode.LOOSE,
        )
        with self.assertRaises(BillingOperationError):
            # 0.500 alone fits under 1.000, but 0.800 + 0.500 does not.
            add_product_to_draft(
                sale_id=sale.pk, user=self.owner, product_id=self.rice.pk,
                quantity=Decimal("2"),
                pricing_mode=SaleItem.PricingMode.PACKET, packet_id=self.packet_250.pk,
            )
        self.assertEqual(SaleItem.objects.filter(sale=sale).count(), 1)

    def test_checkout_rejects_a_pair_of_lines_that_jointly_exceed_stock(self):
        """The same aggregation must hold at the final locked check.

        Stock is dropped after both lines were individually valid, so only the
        summed check at completion can catch it.
        """
        sale = self.draft()
        add_product_to_draft(
            sale_id=sale.pk, user=self.owner, product_id=self.rice.pk,
            quantity=Decimal("2.000"), pricing_mode=SaleItem.PricingMode.LOOSE,
        )
        add_product_to_draft(
            sale_id=sale.pk, user=self.owner, product_id=self.rice.pk,
            quantity=Decimal("2"),
            pricing_mode=SaleItem.PricingMode.PACKET, packet_id=self.packet_1kg.pk,
        )
        InventoryBalance.objects.filter(pk=self.balance.pk).update(
            quantity_on_hand=Decimal("3.000")
        )
        with self.assertRaises(BillingOperationError) as caught:
            self.checkout(sale)
        self.assertEqual(caught.exception.field, "inventory")
        sale.refresh_from_db()
        self.assertEqual(sale.status, Sale.Status.DRAFT)
        self.assertEqual(self.on_hand(), Decimal("3.000"))

    def test_a_standard_product_rejects_packet_and_loose_modes(self):
        milk = Product.objects.create(
            shop=self.shop, name="Milk", sku="MILK-001",
            unit=Product.Unit.BOTTLE, selling_price=Decimal("6.00"),
        )
        InventoryBalance.objects.create(
            shop=self.shop, product=milk,
            quantity_on_hand=Decimal("5.000"), low_stock_threshold=Decimal("1.000"),
        )
        sale = self.draft()
        with self.assertRaises(BillingOperationError) as caught:
            add_product_to_draft(
                sale_id=sale.pk, user=self.owner, product_id=milk.pk,
                quantity=Decimal("1"), pricing_mode=SaleItem.PricingMode.LOOSE,
            )
        self.assertEqual(caught.exception.field, "pricing_mode")

    def test_a_multi_pricing_product_requires_an_explicit_mode(self):
        sale = self.draft()
        with self.assertRaises(BillingOperationError) as caught:
            add_product_to_draft(
                sale_id=sale.pk, user=self.owner, product_id=self.rice.pk,
                quantity=Decimal("1"),
            )
        self.assertEqual(caught.exception.field, "pricing_mode")

    def test_a_packet_from_another_product_is_rejected(self):
        other = Product.objects.create(
            shop=self.shop, name="Sugar", sku="SUGAR-001",
            unit=Product.Unit.KG, selling_price=Decimal("5.00"),
            pricing_mode=Product.PricingMode.MULTI,
        )
        foreign = ProductPacket.objects.create(
            product=other, size=Decimal("0.500"), price=Decimal("2.75")
        )
        sale = self.draft()
        with self.assertRaises(BillingOperationError) as caught:
            add_product_to_draft(
                sale_id=sale.pk, user=self.owner, product_id=self.rice.pk,
                quantity=Decimal("1"),
                pricing_mode=SaleItem.PricingMode.PACKET, packet_id=foreign.pk,
            )
        self.assertEqual(caught.exception.field, "packet_id")

    def test_fractional_packet_counts_are_rejected(self):
        sale = self.draft()
        with self.assertRaises(BillingOperationError) as caught:
            add_product_to_draft(
                sale_id=sale.pk, user=self.owner, product_id=self.rice.pk,
                quantity=Decimal("1.5"),
                pricing_mode=SaleItem.PricingMode.PACKET, packet_id=self.packet_250.pk,
            )
        self.assertEqual(caught.exception.field, "quantity")

    def test_resuming_a_held_bill_revalidates_the_packet_price(self):
        sale = self.draft()
        add_product_to_draft(
            sale_id=sale.pk, user=self.owner, product_id=self.rice.pk,
            quantity=Decimal("1"),
            pricing_mode=SaleItem.PricingMode.PACKET, packet_id=self.packet_250.pk,
        )
        hold_draft_sale(sale_id=sale.pk, user=self.owner)
        ProductPacket.objects.filter(pk=self.packet_250.pk).update(price=Decimal("3.95"))
        with self.assertRaises(BillingOperationError) as caught:
            resume_held_sale(sale_id=sale.pk, user=self.owner)
        self.assertIn("new price", caught.exception.message)


class MultiPricingApiTests(MultiPricingTestBase):
    def setUp(self):
        super().setUp()
        self.client.force_login(self.owner)

    def test_billing_list_exposes_pricing_mode_and_active_packets(self):
        ProductPacket.objects.create(
            product=self.rice, size=Decimal("5.000"),
            price=Decimal("60.00"), is_active=False,
        )
        response = self.client.get(reverse("inventory_api:list"))
        self.assertEqual(response.status_code, 200)
        product = next(
            row["product"]
            for row in response.json()["data"]["results"]
            if row["product"]["sku"] == "RICE-001"
        )
        self.assertEqual(product["pricing_mode"], "MULTI")
        # The withdrawn 5 kg packet must not be offered for sale again.
        self.assertEqual(
            sorted(packet["size"] for packet in product["packets"]),
            ["0.250", "1.000"],
        )

    def test_standard_products_serialize_with_an_empty_packet_list(self):
        Product.objects.create(
            shop=self.shop, name="Milk", sku="MILK-001",
            unit=Product.Unit.BOTTLE, selling_price=Decimal("6.00"),
        )
        response = self.client.get(reverse("products_api:product-list"))
        product = next(
            row for row in response.json()["data"]["results"] if row["sku"] == "MILK-001"
        )
        self.assertEqual(product["pricing_mode"], "STANDARD")
        self.assertEqual(product["packets"], [])

    def test_owner_defines_packets_when_creating_a_multi_pricing_product(self):
        response = self.client.post(
            reverse("products_api:product-list"),
            {
                "name": "Sugar", "sku": "SUGAR-001", "unit": "KG",
                "selling_price": "5.00", "purchase_price": "0.00",
                "tax_rate": "0.00", "is_tax_inclusive": False, "is_active": True,
                "pricing_mode": "MULTI",
                "packets": [
                    {"size": "0.500", "price": "2.75"},
                    {"size": "1.000", "price": "5.20"},
                ],
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        product = Product.objects.get(sku="SUGAR-001")
        self.assertEqual(product.pricing_mode, Product.PricingMode.MULTI)
        self.assertEqual(
            [(p.size, p.price) for p in product.packets.order_by("size")],
            [(Decimal("0.500"), Decimal("2.75")), (Decimal("1.000"), Decimal("5.20"))],
        )

    def test_multi_pricing_without_any_packet_is_rejected(self):
        response = self.client.post(
            reverse("products_api:product-list"),
            {
                "name": "Flour", "sku": "FLOUR-001", "unit": "KG",
                "selling_price": "4.00", "purchase_price": "0.00",
                "tax_rate": "0.00", "is_tax_inclusive": False, "is_active": True,
                "pricing_mode": "MULTI", "packets": [],
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("packets", response.json()["errors"])

    def test_duplicate_packet_sizes_are_rejected(self):
        response = self.client.post(
            reverse("products_api:product-list"),
            {
                "name": "Lentils", "sku": "LENTIL-001", "unit": "KG",
                "selling_price": "4.00", "purchase_price": "0.00",
                "tax_rate": "0.00", "is_tax_inclusive": False, "is_active": True,
                "pricing_mode": "MULTI",
                "packets": [
                    {"size": "0.500", "price": "2.75"},
                    {"size": "0.500", "price": "3.00"},
                ],
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("packets", response.json()["errors"])

    def test_packets_on_a_standard_product_are_rejected(self):
        response = self.client.post(
            reverse("products_api:product-list"),
            {
                "name": "Soap", "sku": "SOAP-001", "unit": "PIECE",
                "selling_price": "4.00", "purchase_price": "0.00",
                "tax_rate": "0.00", "is_tax_inclusive": False, "is_active": True,
                "packets": [{"size": "1.000", "price": "4.00"}],
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("packets", response.json()["errors"])

    def test_a_packet_already_sold_is_deactivated_rather_than_deleted(self):
        sale = self.draft()
        add_product_to_draft(
            sale_id=sale.pk, user=self.owner, product_id=self.rice.pk,
            quantity=Decimal("1"),
            pricing_mode=SaleItem.PricingMode.PACKET, packet_id=self.packet_250.pk,
        )
        self.checkout(sale)
        response = self.client.patch(
            reverse("products_api:product-detail", args=[self.rice.pk]),
            {"pricing_mode": "MULTI", "packets": [{"size": "1.000", "price": "13.00"}]},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.packet_250.refresh_from_db()
        # Kept, so the completed sale still resolves what it was billed under.
        self.assertFalse(self.packet_250.is_active)

    def test_adding_a_packet_line_through_the_billing_api(self):
        sale = self.draft()
        response = self.client.post(
            reverse("sales_api:draft-item-create", args=[sale.pk]),
            {
                "product_id": str(self.rice.pk),
                "quantity": "2",
                "pricing_mode": "PACKET",
                "packet_id": str(self.packet_250.pk),
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        item = response.json()["data"]["items"][0]
        self.assertEqual(item["pricing_mode"], "PACKET")
        self.assertEqual(item["packet_size"], "0.250")
        self.assertEqual(item["quantity"], "2.000")
        self.assertEqual(item["stock_quantity"], "0.500")
        self.assertEqual(item["line_total"], "7.00")

    def test_a_packet_id_without_packet_mode_is_rejected(self):
        sale = self.draft()
        response = self.client.post(
            reverse("sales_api:draft-item-create", args=[sale.pk]),
            {
                "product_id": str(self.rice.pk),
                "quantity": "1",
                "pricing_mode": "LOOSE",
                "packet_id": str(self.packet_250.pk),
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("packet_id", response.json()["errors"])
