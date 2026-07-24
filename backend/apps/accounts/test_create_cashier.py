from io import StringIO
from unittest.mock import patch

from django.core.management import CommandError, call_command
from django.test import TestCase

from apps.accounts.models import User
from apps.shops.models import Shop

PASSWORD = "SecureCashierPassword123!"


class CreateCashierCommandTests(TestCase):
    def setUp(self):
        self.shop = Shop.objects.create(
            name="Cashier Command Grocery",
            address="Doha",
            phone="+974 5555 0501",
        )
        self.other_shop = Shop.objects.create(
            name="Second Cashier Grocery",
            address="Doha",
            phone="+974 5555 0502",
        )

    def run_command(self, shop, username="counter-user"):
        output = StringIO()
        with patch(
            "apps.accounts.management.commands.create_cashier.getpass.getpass",
            side_effect=[PASSWORD, PASSWORD],
        ):
            call_command(
                "create_cashier",
                shop_id=str(shop.id),
                username=username,
                full_name="Counter Cashier",
                email="CASHIER@EXAMPLE.COM",
                stdout=output,
            )
        return output.getvalue()

    def test_creates_active_cashier_with_hashed_password_and_safe_output(self):
        output = self.run_command(self.shop, " Counter-User ")
        cashier = User.objects.get(shop=self.shop, username="counter-user")
        self.assertEqual(cashier.role, User.Role.CASHIER)
        self.assertTrue(cashier.is_active)
        self.assertTrue(cashier.check_password(PASSWORD))
        self.assertEqual(cashier.email, "CASHIER@example.com")
        self.assertIn(self.shop.name, output)
        self.assertIn(str(self.shop.id), output)
        self.assertNotIn(PASSWORD, output)

    def test_inactive_and_invalid_shop_are_rejected(self):
        self.shop.is_active = False
        self.shop.save(update_fields=["is_active"])
        with self.assertRaises(CommandError):
            self.run_command(self.shop)
        with self.assertRaises(CommandError):
            call_command(
                "create_cashier",
                shop_id="00000000-0000-0000-0000-000000000000",
                username="cashier",
                full_name="Cashier",
            )

    def test_duplicate_same_shop_is_rejected_but_other_shop_is_allowed(self):
        self.run_command(self.shop)
        with self.assertRaises(CommandError):
            self.run_command(self.shop, "COUNTER-USER")
        self.run_command(self.other_shop)
        self.assertEqual(
            User.objects.filter(username="counter-user").count(),
            2,
        )
