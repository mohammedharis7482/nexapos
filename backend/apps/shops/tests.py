from django.test import TestCase

from .models import Shop


class ShopModelTests(TestCase):
    def test_shop_creation(self):
        shop = Shop.objects.create(
            name="Al Noor Grocery",
            address="Doha, Qatar",
            phone="+974 5555 0101",
        )

        self.assertEqual(str(shop), "Al Noor Grocery")
        self.assertTrue(shop.id)

    def test_shop_defaults(self):
        shop = Shop.objects.create(
            name="Al Safa Grocery",
            address="Doha, Qatar",
            phone="+974 5555 0102",
        )

        self.assertEqual(shop.currency, "QAR")
        self.assertEqual(shop.timezone, "Asia/Qatar")
        self.assertEqual(shop.invoice_prefix, "INV")
        self.assertTrue(shop.is_active)
