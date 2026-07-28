from unittest.mock import patch
from uuid import uuid4

from django.core.management import CommandError, call_command
from django.core.cache import cache
from django.test import Client, TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.shops.models import Shop
from common.permissions import IsCashierOrOwner, IsOwner, IsSameShop
from common.throttling import LoginContextThrottle, LoginIpThrottle

from .models import User

PASSWORD = "FoundationPassword123!"
NEW_PASSWORD = "ChangedFoundationPassword456!"


class SessionAuthenticationApiTests(TestCase):
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
        cls.owner = User.objects.create_user(
            shop=cls.shop,
            username="ahmed",
            password=PASSWORD,
            full_name="Ahmed Kareem",
            role=User.Role.OWNER,
        )
        cls.cashier = User.objects.create_user(
            shop=cls.shop,
            username="fatima",
            password=PASSWORD,
            full_name="Fatima Noor",
            role=User.Role.CASHIER,
        )
        cls.same_username_other_shop = User.objects.create_user(
            shop=cls.other_shop,
            username="ahmed",
            password=NEW_PASSWORD,
            full_name="Ahmed Other",
            role=User.Role.OWNER,
        )

    def setUp(self):
        cache.clear()
        self.client = Client(enforce_csrf_checks=True)

    def csrf_token(self) -> str:
        response = self.client.get(reverse("accounts_api:csrf"))
        self.assertEqual(response.status_code, 200)
        return response.cookies["csrftoken"].value

    def login(self, user=None, password=PASSWORD, shop=None):
        user = user or self.owner
        shop = shop or user.shop
        token = self.csrf_token()
        return self.client.post(
            reverse("accounts_api:login"),
            {
                "shop_id": str(shop.id),
                "username": user.username,
                "password": password,
            },
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )

    def test_csrf_cookie_initialization(self):
        response = self.client.get(reverse("accounts_api:csrf"))

        self.assertEqual(response.status_code, 200)
        self.assertIn("csrftoken", response.cookies)
        self.assertEqual(
            response.json(),
            {
                "success": True,
                "message": "CSRF cookie initialized.",
                "data": None,
            },
        )

    def test_auth_routes_use_exact_trailing_slashes_without_redirects(self):
        expected_paths = {
            "csrf": "/api/v1/auth/csrf/",
            "login": "/api/v1/auth/login/",
            "logout": "/api/v1/auth/logout/",
            "me": "/api/v1/auth/me/",
            "change-password": "/api/v1/auth/change-password/",
        }
        for name, path in expected_paths.items():
            with self.subTest(name=name):
                self.assertEqual(reverse(f"accounts_api:{name}"), path)

        response = self.client.get("/api/v1/auth/me/", follow=False)
        self.assertEqual(response.status_code, 401)
        self.assertNotIn(response.status_code, (301, 308))

    def test_successful_owner_login_creates_session_and_safe_response(self):
        pre_login_session = self.client.session
        pre_login_session["pre_login"] = True
        pre_login_session.save()
        old_session_key = pre_login_session.session_key
        response = self.login()

        self.assertEqual(response.status_code, 200)
        self.assertIn("_auth_user_id", self.client.session)
        self.assertNotEqual(self.client.session.session_key, old_session_key)
        user_data = response.json()["data"]["user"]
        self.assertEqual(user_data["role"], User.Role.OWNER)
        self.assertTrue(
            {"id", "full_name", "username", "role", "shop", "capabilities"}
            <= set(user_data)
        )
        self.assertTrue(
            {"id", "name", "currency", "timezone", "status"}
            <= set(user_data["shop"])
        )
        forbidden = {"password", "session", "session_key", "permissions"}
        self.assertTrue(forbidden.isdisjoint(user_data))

    def test_successful_cashier_login(self):
        response = self.login(user=self.cashier)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["user"]["role"], User.Role.CASHIER)

    def test_wrong_password_and_wrong_shop_are_generic(self):
        wrong_password = self.login(password="IncorrectPassword123!")
        self.assertEqual(wrong_password.status_code, 401)
        wrong_shop = self.login(shop=self.other_shop)
        self.assertEqual(wrong_shop.status_code, 401)
        self.assertEqual(wrong_password.json()["message"], wrong_shop.json()["message"])
        self.assertEqual(wrong_password.json()["code"], "INVALID_CREDENTIALS")
        self.assertEqual(wrong_shop.json()["code"], "INVALID_CREDENTIALS")

    def test_unknown_shop_is_generic(self):
        token = self.csrf_token()
        response = self.client.post(
            reverse("accounts_api:login"),
            {
                "shop_id": str(uuid4()),
                "username": self.owner.username,
                "password": PASSWORD,
            },
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )

        self.assertEqual(response.status_code, 401)

    def test_inactive_user_and_shop_are_rejected(self):
        self.owner.is_active = False
        self.owner.save(update_fields=["is_active"])
        inactive = self.login()
        self.assertEqual(inactive.status_code, 403)
        self.assertEqual(inactive.json()["code"], "USER_INACTIVE")
        self.owner.is_active = True
        self.owner.save(update_fields=["is_active"])

        self.shop.is_active = False
        self.shop.save(update_fields=["is_active"])
        inactive_shop = self.login()
        self.assertEqual(inactive_shop.status_code, 403)
        self.assertEqual(inactive_shop.json()["code"], "SHOP_SUSPENDED")
        self.shop.is_active = True
        self.shop.status = Shop.Status.CANCELLED
        self.shop.save(update_fields=["is_active", "status"])
        cancelled = self.login()
        self.assertEqual(cancelled.status_code, 403)
        self.assertEqual(cancelled.json()["code"], "SHOP_CANCELLED")

    def test_unverified_registered_owner_gets_safe_guidance_without_session(self):
        pending_shop = Shop.objects.create(
            name="Pending Registration",
            address="Doha",
            phone="+97450000999",
            email="pending-owner@example.test",
            status=Shop.Status.PENDING_VERIFICATION,
        )
        pending_owner = User.objects.create_user(
            shop=pending_shop,
            username=" PendingOwner ",
            password=PASSWORD,
            full_name="Pending Owner",
            email="pending-owner@example.test",
            role=User.Role.OWNER,
        )
        pending_shop.primary_owner = pending_owner
        pending_shop.save(update_fields=["primary_owner", "updated_at"])

        response = self.login(user=pending_owner)

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], "EMAIL_NOT_VERIFIED")
        self.assertEqual(
            response.json()["errors"], {"can_resend_verification": True}
        )
        self.assertNotIn("_auth_user_id", self.client.session)

        wrong_password = self.login(
            user=pending_owner,
            password="IncorrectPassword123!",
        )
        self.assertEqual(wrong_password.status_code, 401)
        self.assertEqual(wrong_password.json()["code"], "INVALID_CREDENTIALS")

    def test_verified_registered_owner_can_login_with_normalized_context(self):
        pending_shop = Shop.objects.create(
            name="Verified Registration",
            address="Doha",
            phone="+97450000998",
            email="verified-owner@example.test",
            status=Shop.Status.ONBOARDING,
        )
        owner = User.objects.create_user(
            shop=pending_shop,
            username="firstowner",
            password=PASSWORD,
            full_name="First Owner",
            email="verified-owner@example.test",
            email_verified_at=timezone.now(),
            role=User.Role.OWNER,
        )
        pending_shop.primary_owner = owner
        pending_shop.save(update_fields=["primary_owner", "updated_at"])
        token = self.csrf_token()
        response = self.client.post(
            reverse("accounts_api:login"),
            {
                "shop_id": f"  {pending_shop.id}  ",
                "username": "  FIRSTOWNER  ",
                "password": PASSWORD,
            },
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["data"]["user"]["shop"]["status"],
            Shop.Status.ONBOARDING,
        )

    def test_existing_session_is_invalidated_when_shop_becomes_inactive(self):
        self.assertEqual(self.login().status_code, 200)
        self.shop.is_active = False
        self.shop.save(update_fields=["is_active"])

        response = self.client.get(reverse("accounts_api:me"))

        self.assertEqual(response.status_code, 401)
        self.assertNotIn("_auth_user_id", self.client.session)

    @patch.object(LoginIpThrottle, "THROTTLE_RATES", {"login_ip": "100/min"})
    @patch.object(
        LoginContextThrottle,
        "THROTTLE_RATES",
        {"login_context": "2/min"},
    )
    def test_login_attempts_are_throttled_without_account_disclosure(self):
        for _ in range(2):
            response = self.login(password="IncorrectPassword123!")
            self.assertEqual(response.status_code, 401)

        throttled = self.login(password="IncorrectPassword123!")

        self.assertEqual(throttled.status_code, 429)
        self.assertNotIn(self.owner.username, throttled.json()["message"])
        self.assertNotIn(str(self.shop.id), throttled.json()["message"])

    def test_same_username_authenticates_only_selected_shop(self):
        response = self.login(
            user=self.same_username_other_shop,
            password=NEW_PASSWORD,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["data"]["user"]["shop"]["id"],
            str(self.other_shop.id),
        )

    def test_me_requires_authentication_and_returns_current_user(self):
        unauthenticated = self.client.get(reverse("accounts_api:me"))
        self.assertEqual(unauthenticated.status_code, 401)

        self.login()
        authenticated = self.client.get(reverse("accounts_api:me"))
        self.assertEqual(authenticated.status_code, 200)
        self.assertEqual(
            authenticated.json()["data"]["user"]["id"],
            str(self.owner.id),
        )

    def test_logout_invalidates_session(self):
        self.login()
        token = self.client.cookies["csrftoken"].value
        response = self.client.post(
            reverse("accounts_api:logout"),
            HTTP_X_CSRFTOKEN=token,
        )

        self.assertEqual(response.status_code, 200)
        self.assertNotIn("_auth_user_id", self.client.session)
        self.assertEqual(self.client.get(reverse("accounts_api:me")).status_code, 401)

    def test_csrf_rejects_unsafe_authenticated_request(self):
        self.client.force_login(
            self.owner,
            backend="common.authentication.ShopModelBackend",
        )

        response = self.client.post(
            reverse("accounts_api:change-password"),
            {
                "current_password": PASSWORD,
                "new_password": NEW_PASSWORD,
                "confirm_password": NEW_PASSWORD,
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)

    def test_login_requires_csrf(self):
        response = self.client.post(
            reverse("accounts_api:login"),
            {
                "shop_id": str(self.shop.id),
                "username": self.owner.username,
                "password": PASSWORD,
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)

    def test_successful_password_change_preserves_session(self):
        self.login()
        token = self.client.cookies["csrftoken"].value
        response = self.client.post(
            reverse("accounts_api:change-password"),
            {
                "current_password": PASSWORD,
                "new_password": NEW_PASSWORD,
                "confirm_password": NEW_PASSWORD,
            },
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )

        self.assertEqual(response.status_code, 200)
        self.owner.refresh_from_db()
        self.assertTrue(self.owner.check_password(NEW_PASSWORD))
        self.assertEqual(self.client.get(reverse("accounts_api:me")).status_code, 200)

    def test_wrong_current_password_returns_field_error(self):
        self.login()
        token = self.client.cookies["csrftoken"].value
        response = self.client.post(
            reverse("accounts_api:change-password"),
            {
                "current_password": "IncorrectPassword123!",
                "new_password": NEW_PASSWORD,
                "confirm_password": NEW_PASSWORD,
            },
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("current_password", response.json()["errors"])

    def test_password_validation_and_confirmation_errors(self):
        self.login()
        token = self.client.cookies["csrftoken"].value
        weak = self.client.post(
            reverse("accounts_api:change-password"),
            {
                "current_password": PASSWORD,
                "new_password": "123",
                "confirm_password": "123",
            },
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(weak.status_code, 400)
        self.assertIn("new_password", weak.json()["errors"])

        mismatch = self.client.post(
            reverse("accounts_api:change-password"),
            {
                "current_password": PASSWORD,
                "new_password": NEW_PASSWORD,
                "confirm_password": "DifferentFoundationPassword789!",
            },
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(mismatch.status_code, 400)
        self.assertIn("confirm_password", mismatch.json()["errors"])


class PermissionTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.shop = Shop.objects.create(
            name="Permission Shop",
            address="Doha",
            phone="+974 5555 0103",
        )
        cls.other_shop = Shop.objects.create(
            name="Other Permission Shop",
            address="Doha",
            phone="+974 5555 0104",
        )
        cls.owner = User.objects.create_user(
            shop=cls.shop,
            username="owner",
            password=PASSWORD,
            full_name="Owner",
            role=User.Role.OWNER,
        )
        cls.cashier = User.objects.create_user(
            shop=cls.shop,
            username="cashier",
            password=PASSWORD,
            full_name="Cashier",
        )

    def request_for(self, user):
        request = APIRequestFactory().get("/")
        force_authenticate(request, user=user)
        request.user = user
        return request

    def test_owner_and_cashier_permissions(self):
        self.assertTrue(IsOwner().has_permission(self.request_for(self.owner), None))
        self.assertFalse(IsOwner().has_permission(self.request_for(self.cashier), None))
        self.assertTrue(
            IsCashierOrOwner().has_permission(self.request_for(self.owner), None)
        )
        self.assertTrue(
            IsCashierOrOwner().has_permission(self.request_for(self.cashier), None)
        )

    def test_cross_shop_object_is_denied(self):
        permission = IsSameShop()
        request = self.request_for(self.owner)

        self.assertTrue(
            permission.has_object_permission(request, None, self.shop)
        )
        self.assertFalse(
            permission.has_object_permission(request, None, self.other_shop)
        )


class BootstrapShopCommandTests(TestCase):
    options = {
        "shop_name": "Bootstrap Grocery",
        "address": "Doha, Qatar",
        "phone": "+974 5555 0110",
        "username": "first-owner",
        "full_name": "First Owner",
        "email": "owner@example.com",
    }

    @patch(
        "apps.accounts.management.commands.bootstrap_shop.Command._prompt_password",
        return_value=PASSWORD,
    )
    def test_bootstrap_creates_shop_and_hashed_owner(self, _prompt):
        call_command("bootstrap_shop", **self.options)

        shop = Shop.objects.get(name=self.options["shop_name"])
        owner = User.objects.get(shop=shop, username=self.options["username"])
        self.assertEqual(owner.role, User.Role.OWNER)
        self.assertTrue(owner.check_password(PASSWORD))
        self.assertNotEqual(owner.password, PASSWORD)

    @patch(
        "apps.accounts.management.commands.bootstrap_shop.Command._prompt_password",
        return_value=PASSWORD,
    )
    def test_bootstrap_prevents_duplicates(self, _prompt):
        call_command("bootstrap_shop", **self.options)

        with self.assertRaises(CommandError):
            call_command("bootstrap_shop", **self.options)
        self.assertEqual(Shop.objects.filter(name=self.options["shop_name"]).count(), 1)
        self.assertEqual(
            User.objects.filter(
                shop__name=self.options["shop_name"],
                username=self.options["username"],
            ).count(),
            1,
        )
