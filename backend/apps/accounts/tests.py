from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase

from apps.shops.models import Shop

from .models import User


class UserModelTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.shop = Shop.objects.create(
            name="Al Noor Grocery",
            address="Doha, Qatar",
            phone="+974 5555 0101",
        )
        cls.other_shop = Shop.objects.create(
            name="Al Safa Grocery",
            address="Al Wakrah, Qatar",
            phone="+974 5555 0102",
        )

    def test_owner_creation_and_password_hashing(self):
        owner = User.objects.create_user(
            username="  OWNER ",
            password="StrongPassword123!",
            shop=self.shop,
            full_name="Shop Owner",
            role=User.Role.OWNER,
        )

        self.assertEqual(owner.username, "owner")
        self.assertEqual(owner.role, User.Role.OWNER)
        self.assertTrue(owner.check_password("StrongPassword123!"))
        self.assertNotEqual(owner.password, "StrongPassword123!")

    def test_cashier_creation_and_shop_relationship(self):
        cashier = User.objects.create_user(
            username="cashier",
            password="StrongPassword123!",
            shop=self.shop,
            full_name="Till Operator",
        )

        self.assertEqual(cashier.role, User.Role.CASHIER)
        self.assertEqual(cashier.shop, self.shop)
        self.assertIn(cashier, self.shop.users.all())

    def test_role_values(self):
        self.assertEqual(User.Role.values, ["OWNER", "CASHIER"])

    def test_shop_is_required(self):
        with self.assertRaises(ValueError):
            User.objects.create_user(
                username="cashier",
                password="StrongPassword123!",
                shop=None,
                full_name="Till Operator",
            )

    def test_duplicate_username_in_same_shop_is_rejected(self):
        User.objects.create_user(
            username="cashier",
            password="StrongPassword123!",
            shop=self.shop,
            full_name="First Cashier",
        )

        with self.assertRaises((ValidationError, IntegrityError)):
            with transaction.atomic():
                User.objects.create_user(
                    username="CASHIER",
                    password="AnotherStrongPassword123!",
                    shop=self.shop,
                    full_name="Second Cashier",
                )

    def test_same_username_in_different_shops_is_permitted(self):
        first = User.objects.create_user(
            username="cashier",
            password="StrongPassword123!",
            shop=self.shop,
            full_name="First Cashier",
        )
        second = User.objects.create_user(
            username="CASHIER",
            password="AnotherStrongPassword123!",
            shop=self.other_shop,
            full_name="Second Cashier",
        )

        self.assertEqual(first.username, second.username)
        self.assertNotEqual(first.shop, second.shop)
