from decimal import Decimal

from django.test import TestCase
from django.urls import reverse

from apps.accounts.models import User

from .models import Shop

PASSWORD = "SettingsFoundationPassword123!"


class ShopSettingsApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.shop = Shop.objects.create(
            name="Al Noor Grocery",
            address="Doha, Qatar",
            phone="+974 5555 0201",
        )
        cls.other_shop = Shop.objects.create(
            name="Other Grocery",
            address="Al Wakrah, Qatar",
            phone="+974 5555 0202",
        )
        cls.owner = User.objects.create_user(
            shop=cls.shop,
            username="settings-owner",
            password=PASSWORD,
            full_name="Settings Owner",
            role=User.Role.OWNER,
        )
        cls.cashier = User.objects.create_user(
            shop=cls.shop,
            username="settings-cashier",
            password=PASSWORD,
            full_name="Settings Cashier",
        )
        cls.other_owner = User.objects.create_user(
            shop=cls.other_shop,
            username="other-owner",
            password=PASSWORD,
            full_name="Other Owner",
            role=User.Role.OWNER,
        )
        cls.url = reverse("shops_api:settings")

    def login(self, user):
        self.client.force_login(
            user,
            backend="common.authentication.ShopModelBackend",
        )

    def test_authenticated_user_reads_only_own_shop_settings(self):
        self.login(self.owner)
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["name"], self.shop.name)
        self.assertEqual(response.json()["data"]["id"], str(self.shop.id))

        self.client.logout()
        self.login(self.other_owner)
        other_response = self.client.get(self.url)
        self.assertEqual(
            other_response.json()["data"]["name"],
            self.other_shop.name,
        )

    def test_owner_updates_qatar_shop_settings(self):
        self.login(self.owner)
        response = self.client.patch(
            self.url,
            {
                "name": "Al Noor Market",
                "city": "Doha",
                "country": "Qatar",
                "currency": "QAR",
                "timezone": "Asia/Qatar",
                "tax_registration_number": "TRN-100",
                "default_tax_rate": "5.00",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.shop.refresh_from_db()
        self.assertEqual(self.shop.name, "Al Noor Market")
        self.assertEqual(self.shop.default_tax_rate, Decimal("5.00"))

    def test_cashier_update_is_forbidden(self):
        self.login(self.cashier)
        response = self.client.patch(
            self.url,
            {"name": "Not Allowed"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)

    def test_shop_id_cannot_be_changed(self):
        self.login(self.owner)
        response = self.client.patch(
            self.url,
            {"shop_id": str(self.other_shop.id), "name": "Attempt"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("shop_id", response.json()["errors"])
        self.owner.refresh_from_db()
        self.assertEqual(self.owner.shop_id, self.shop.id)

    def test_qatar_defaults_are_enforced(self):
        self.login(self.owner)
        response = self.client.patch(
            self.url,
            {
                "country": "Other",
                "currency": "USD",
                "timezone": "UTC",
                "default_tax_rate": "101.00",
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            set(response.json()["errors"]),
            {"country", "currency", "timezone", "default_tax_rate"},
        )
