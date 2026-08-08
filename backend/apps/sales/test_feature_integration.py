"""One product carrying image + multi-pricing + a second name, end to end.

Each feature has its own suite; these exercise them coexisting on a single
product, which is where independently-built features tend to interact.
"""

import shutil
import tempfile
from decimal import Decimal
from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.db import connection
from django.urls import reverse
from PIL import Image

from apps.accounts.models import User
from apps.inventory.models import InventoryBalance
from apps.products.models import Product, ProductPacket
from apps.sales.models import Sale, SaleItem
from apps.sales.services import (
    add_product_to_draft,
    complete_sale,
    create_draft_sale,
    open_shift,
)
from apps.shops.models import Shop

PASSWORD = "IntegrationPassword123!"
ARABIC_RICE = "أرز بسمتي"
MEDIA_ROOT = tempfile.mkdtemp(prefix="nexapos-integration-")


def jpeg(name="rice.jpg"):
    buffer = BytesIO()
    Image.new("RGB", (24, 24), (200, 160, 60)).save(buffer, format="JPEG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/jpeg")


@override_settings(MEDIA_ROOT=MEDIA_ROOT)
class AllFeaturesOnOneProductTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(MEDIA_ROOT, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.shop = Shop.objects.create(
            name="Integration Grocery",
            address="Doha",
            phone="+97450009601",
            status=Shop.Status.ACTIVE,
            secondary_language=Shop.Language.ARABIC,
        )
        self.owner = User.objects.create_user(
            shop=self.shop,
            username="integration_owner",
            password=PASSWORD,
            full_name="Integration Owner",
            role=User.Role.OWNER,
        )
        # Every feature at once: a photo, two packet sizes, and an Arabic name.
        self.rice = Product.objects.create(
            shop=self.shop,
            name="Basmati Rice",
            secondary_name=ARABIC_RICE,
            sku="RICE-INT",
            unit=Product.Unit.KG,
            selling_price=Decimal("12.00"),
            pricing_mode=Product.PricingMode.MULTI,
        )
        self.packet_250 = ProductPacket.objects.create(
            product=self.rice, size=Decimal("0.250"), price=Decimal("3.50"),
        )
        self.packet_1kg = ProductPacket.objects.create(
            product=self.rice, size=Decimal("1.000"), price=Decimal("13.00"),
            display_order=1,
        )
        InventoryBalance.objects.create(
            shop=self.shop, product=self.rice,
            quantity_on_hand=Decimal("10.000"), low_stock_threshold=Decimal("1.000"),
        )
        self.client.force_login(self.owner)
        self.client.post(
            reverse("products_api:product-image", args=[self.rice.pk]),
            {"image": jpeg()},
        )
        self.rice.refresh_from_db()
        open_shift(user=self.owner)

    def _billing_row(self):
        response = self.client.get(reverse("inventory_api:list"), {"search": "Basmati"})
        self.assertEqual(response.status_code, 200)
        return response.json()["data"]["results"][0]["product"]

    def test_the_billing_card_carries_image_packets_and_second_name_together(self):
        product = self._billing_row()
        self.assertTrue(product["image_url"])
        self.assertEqual(product["secondary_name"], ARABIC_RICE)
        self.assertEqual(product["pricing_mode"], "MULTI")
        self.assertEqual(len(product["packets"]), 2)

    def test_searching_the_second_name_still_returns_packets_and_the_image(self):
        """Search matched on one feature must not drop the other two."""
        response = self.client.get(reverse("inventory_api:list"), {"search": ARABIC_RICE})
        product = response.json()["data"]["results"][0]["product"]
        self.assertEqual(len(product["packets"]), 2)
        self.assertTrue(product["image_url"])

    def test_a_packet_line_carries_every_feature_through_to_the_receipt(self):
        sale = create_draft_sale(user=self.owner)
        add_product_to_draft(
            sale_id=sale.pk, user=self.owner, product_id=self.rice.pk,
            quantity=Decimal("2"),
            pricing_mode=SaleItem.PricingMode.PACKET, packet_id=self.packet_250.pk,
        )
        sale.refresh_from_db()
        complete_sale(
            sale_id=sale.pk, user=self.owner,
            payments=[{"method": "CASH", "amount": sale.grand_total}],
            amount_received=sale.grand_total,
        )
        response = self.client.get(reverse("sales_history_api:receipt", args=[sale.pk]))
        self.assertEqual(response.status_code, 200, response.content)
        item = response.json()["data"]["sale"]["items"][0]

        # Multi-language: snapshotted name travels to the receipt.
        self.assertEqual(item["product"]["secondary_name"], ARABIC_RICE)
        # Images: read live, still present.
        self.assertTrue(item["product"]["image_url"])
        # Multi-pricing: the receipt has everything it needs to describe the
        # line honestly - packets charged, and the real weight sold.
        self.assertEqual(item["pricing_mode"], "PACKET")
        self.assertEqual(item["quantity"], "2.000")
        self.assertEqual(item["packet_size"], "0.250")
        self.assertEqual(item["stock_quantity"], "0.500")
        self.assertEqual(item["unit_price"], "3.50")
        self.assertEqual(item["line_total"], "7.00")

    def test_a_mixed_bill_keeps_each_line_distinct_with_all_features_present(self):
        sale = create_draft_sale(user=self.owner)
        add_product_to_draft(
            sale_id=sale.pk, user=self.owner, product_id=self.rice.pk,
            quantity=Decimal("2"),
            pricing_mode=SaleItem.PricingMode.PACKET, packet_id=self.packet_250.pk,
        )
        add_product_to_draft(
            sale_id=sale.pk, user=self.owner, product_id=self.rice.pk,
            quantity=Decimal("0.750"), pricing_mode=SaleItem.PricingMode.LOOSE,
        )
        response = self.client.get(reverse("sales_api:draft-detail", args=[sale.pk]))
        items = response.json()["data"]["items"]
        self.assertEqual(len(items), 2)
        # Both lines carry the same product's image and second name, but
        # different pricing identities.
        for item in items:
            self.assertEqual(item["product"]["secondary_name"], ARABIC_RICE)
            self.assertTrue(item["product"]["image_url"])
        self.assertEqual(
            sorted(item["pricing_mode"] for item in items), ["LOOSE", "PACKET"]
        )

    def test_the_billing_list_does_not_fan_out_queries_per_product(self):
        """Packets and images must not reintroduce an N+1 on the grid."""
        for index in range(6):
            product = Product.objects.create(
                shop=self.shop, name=f"Extra {index}", secondary_name=f"إضافي {index}",
                sku=f"EXTRA-{index}", unit=Product.Unit.KG,
                selling_price=Decimal("5.00"),
                pricing_mode=Product.PricingMode.MULTI,
            )
            ProductPacket.objects.create(
                product=product, size=Decimal("0.500"), price=Decimal("2.50")
            )
            InventoryBalance.objects.create(
                shop=self.shop, product=product,
                quantity_on_hand=Decimal("5.000"), low_stock_threshold=Decimal("1.000"),
            )
        with CaptureQueriesContext(connection) as captured:
            response = self.client.get(reverse("inventory_api:list"))
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.json()["data"]["results"]), 7)
        # Constant-ish: session/user/shop plus the page and its prefetches.
        # A per-product packet or balance query would push this far higher.
        self.assertLess(
            len(captured.captured_queries), 15,
            f"query count grew with product count: {len(captured.captured_queries)}",
        )

    def test_completing_a_packet_sale_deducts_the_real_weight_not_the_packet_count(self):
        sale = create_draft_sale(user=self.owner)
        add_product_to_draft(
            sale_id=sale.pk, user=self.owner, product_id=self.rice.pk,
            quantity=Decimal("2"),
            pricing_mode=SaleItem.PricingMode.PACKET, packet_id=self.packet_250.pk,
        )
        sale.refresh_from_db()
        complete_sale(
            sale_id=sale.pk, user=self.owner,
            payments=[{"method": "CASH", "amount": sale.grand_total}],
            amount_received=sale.grand_total,
        )
        balance = InventoryBalance.objects.get(product=self.rice)
        self.assertEqual(balance.quantity_on_hand, Decimal("9.500"))

    def test_clearing_the_image_leaves_packets_and_the_second_name_intact(self):
        response = self.client.delete(
            reverse("products_api:product-image", args=[self.rice.pk])
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.rice.refresh_from_db()
        self.assertFalse(self.rice.image)
        self.assertEqual(self.rice.secondary_name, ARABIC_RICE)
        self.assertEqual(self.rice.packets.count(), 2)
        self.assertEqual(self.rice.pricing_mode, Product.PricingMode.MULTI)

    def test_editing_the_product_form_preserves_the_image(self):
        """The dialog PATCHes name/packets; the image is a separate resource
        and must survive a catalogue edit."""
        response = self.client.patch(
            reverse("products_api:product-detail", args=[self.rice.pk]),
            {
                "secondary_name": "أرز",
                "pricing_mode": "MULTI",
                "packets": [{"size": "0.250", "price": "3.75"}],
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.rice.refresh_from_db()
        self.assertTrue(self.rice.image)
        self.assertEqual(self.rice.secondary_name, "أرز")

    def test_a_sale_survives_the_product_losing_every_optional_feature(self):
        """A completed line must stay readable after the catalogue changes."""
        sale = create_draft_sale(user=self.owner)
        add_product_to_draft(
            sale_id=sale.pk, user=self.owner, product_id=self.rice.pk,
            quantity=Decimal("1"),
            pricing_mode=SaleItem.PricingMode.PACKET, packet_id=self.packet_250.pk,
        )
        sale.refresh_from_db()
        complete_sale(
            sale_id=sale.pk, user=self.owner,
            payments=[{"method": "CASH", "amount": sale.grand_total}],
            amount_received=sale.grand_total,
        )
        # Strip the image, the second name, and switch back to STANDARD.
        self.client.delete(reverse("products_api:product-image", args=[self.rice.pk]))
        Product.objects.filter(pk=self.rice.pk).update(
            secondary_name="", pricing_mode=Product.PricingMode.STANDARD
        )
        ProductPacket.objects.filter(pk=self.packet_250.pk).update(is_active=False)

        response = self.client.get(reverse("sales_history_api:receipt", args=[sale.pk]))
        self.assertEqual(response.status_code, 200, response.content)
        item = response.json()["data"]["sale"]["items"][0]
        # Snapshots hold; the live image is simply gone.
        self.assertEqual(item["product"]["secondary_name"], ARABIC_RICE)
        self.assertEqual(item["packet_size"], "0.250")
        self.assertIsNone(item["product"]["image_url"])
        self.assertEqual(Sale.objects.get(pk=sale.pk).status, Sale.Status.COMPLETED)


@override_settings(MEDIA_ROOT=MEDIA_ROOT)
class NewFeatureTenantIsolationTests(TestCase):
    """Tenant isolation for the newer features' inputs.

    The image endpoint already had cross-shop coverage; packet selection and
    second-language search did not. Shop scoping is the app's core invariant,
    so each new client-supplied identifier needs its own proof.
    """

    def setUp(self):
        def build(suffix, phone):
            shop = Shop.objects.create(
                name=f"Isolation {suffix}", address="Doha", phone=phone,
                status=Shop.Status.ACTIVE, secondary_language=Shop.Language.ARABIC,
            )
            owner = User.objects.create_user(
                shop=shop, username=f"iso_{suffix}", password=PASSWORD,
                full_name=f"Owner {suffix}", role=User.Role.OWNER,
            )
            product = Product.objects.create(
                shop=shop, name=f"Rice {suffix}", secondary_name=ARABIC_RICE,
                sku=f"RICE-{suffix}", unit=Product.Unit.KG,
                selling_price=Decimal("12.00"),
                pricing_mode=Product.PricingMode.MULTI,
            )
            packet = ProductPacket.objects.create(
                product=product, size=Decimal("0.250"), price=Decimal("3.50")
            )
            InventoryBalance.objects.create(
                shop=shop, product=product,
                quantity_on_hand=Decimal("10.000"),
                low_stock_threshold=Decimal("1.000"),
            )
            open_shift(user=owner)
            return shop, owner, product, packet

        self.shop_a, self.owner_a, self.product_a, self.packet_a = build("A", "+97450009701")
        self.shop_b, self.owner_b, self.product_b, self.packet_b = build("B", "+97450009702")

    def test_a_packet_from_another_shop_cannot_be_billed(self):
        from apps.sales.exceptions import BillingOperationError

        sale = create_draft_sale(user=self.owner_a)
        with self.assertRaises(BillingOperationError) as caught:
            add_product_to_draft(
                sale_id=sale.pk, user=self.owner_a, product_id=self.product_a.pk,
                quantity=Decimal("1"),
                pricing_mode=SaleItem.PricingMode.PACKET,
                packet_id=self.packet_b.pk,
            )
        self.assertEqual(caught.exception.field, "packet_id")
        self.assertEqual(SaleItem.objects.filter(sale=sale).count(), 0)

    def test_another_shops_product_cannot_be_billed_even_with_its_own_packet(self):
        from apps.sales.exceptions import BillingOperationError

        sale = create_draft_sale(user=self.owner_a)
        with self.assertRaises(BillingOperationError):
            add_product_to_draft(
                sale_id=sale.pk, user=self.owner_a, product_id=self.product_b.pk,
                quantity=Decimal("1"),
                pricing_mode=SaleItem.PricingMode.PACKET,
                packet_id=self.packet_b.pk,
            )

    def test_second_language_search_never_crosses_shops(self):
        """Both shops use the same Arabic name; each must see only its own."""
        self.client.force_login(self.owner_a)
        response = self.client.get(reverse("inventory_api:list"), {"search": ARABIC_RICE})
        skus = [row["product"]["sku"] for row in response.json()["data"]["results"]]
        self.assertEqual(skus, ["RICE-A"])

        self.client.force_login(self.owner_b)
        response = self.client.get(reverse("products_api:product-list"), {"search": ARABIC_RICE})
        self.assertEqual([row["sku"] for row in response.json()["data"]["results"]], ["RICE-B"])

    def test_packets_of_another_shops_product_are_never_serialized(self):
        self.client.force_login(self.owner_a)
        response = self.client.get(reverse("inventory_api:list"))
        ids = {
            packet["id"]
            for row in response.json()["data"]["results"]
            for packet in row["product"]["packets"]
        }
        self.assertNotIn(str(self.packet_b.pk), ids)
        self.assertIn(str(self.packet_a.pk), ids)

    def test_a_shop_cannot_set_the_other_shops_language(self):
        self.client.force_login(self.owner_a)
        self.client.patch(
            reverse("shops_api:settings"), {"secondary_language": "HINDI"},
            content_type="application/json",
        )
        self.shop_b.refresh_from_db()
        self.assertEqual(self.shop_b.secondary_language, Shop.Language.ARABIC)
