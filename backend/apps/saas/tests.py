import re
from datetime import timedelta
from unittest import mock

from django.core import mail
from django.core.cache import cache
from django.core.mail import EmailMessage
from django.db import IntegrityError, transaction
from django.test import Client, TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from apps.accounts.models import User
from apps.products.models import Product
from apps.shops.models import Shop

from .models import (
    EmailVerificationToken,
    PasswordResetToken,
    Plan,
    ShopInvitation,
    ShopSubscription,
)
from .services import (
    SaasOperationError,
    accept_invitation,
    create_staff_user,
    create_invitation,
    hash_token,
    set_user_active,
    reset_staff_password,
    transition_subscription,
)

PASSWORD = "SaaSFoundationPassword123!"
NEW_PASSWORD = "SaaSFoundationChanged456!"


def token_from_email(body: str) -> str:
    match = re.search(r"[?&]token=([^\s&]+)", body)
    if not match:
        raise AssertionError("Action token not found in test email.")
    return match.group(1)


@override_settings(REQUIRE_EMAIL_VERIFICATION=True)
class SaasFoundationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.plan = Plan.objects.get(code="STARTER")
        cls.plan.trial_days = 14
        cls.plan.max_users = 3
        cls.plan.max_products = 2
        cls.plan.save()
        cls.shop = Shop.objects.create(
            name="Existing Grocery",
            address="Doha",
            phone="+97450000001",
            email="owner@existing.test",
            status=Shop.Status.ACTIVE,
            onboarding_completed_at=timezone.now(),
        )
        cls.owner = User.objects.create_user(
            shop=cls.shop,
            username="owner",
            password=PASSWORD,
            full_name="Primary Owner",
            email="owner@existing.test",
            role=User.Role.OWNER,
        )
        cls.shop.primary_owner = cls.owner
        cls.shop.save(update_fields=["primary_owner", "updated_at"])
        cls.subscription = ShopSubscription.objects.create(
            shop=cls.shop,
            plan=cls.plan,
            status=ShopSubscription.Status.ACTIVE,
        )

    def setUp(self):
        cache.clear()
        mail.outbox.clear()
        self.client = Client(enforce_csrf_checks=True)

    def csrf(self):
        response = self.client.get(reverse("accounts_api:csrf"))
        return response.cookies["csrftoken"].value

    def public_post(self, path, data):
        return self.client.post(
            path,
            data,
            content_type="application/json",
            HTTP_X_CSRFTOKEN=self.csrf(),
        )

    def test_registration_is_atomic_and_creates_hashed_owner_trial_and_token(self):
        initial_counts = {
            "shops": Shop.objects.count(),
            "users": User.objects.count(),
            "subscriptions": ShopSubscription.objects.count(),
            "tokens": EmailVerificationToken.objects.count(),
        }
        response = self.public_post(
            reverse("saas_api:register"),
            {
                "shop_name": "New Grocery",
                "owner_full_name": "New Owner",
                "owner_email": "new-owner@example.test",
                "owner_username": "NewOwner",
                "password": PASSWORD,
                "password_confirm": PASSWORD,
                "address": "Doha",
                "phone": "+97450000002",
                "country": "Qatar",
                "timezone": "Asia/Qatar",
                "currency": "QAR",
            },
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            response.json(),
            {
                "success": True,
                "message": "Shop created. Verify the owner email before signing in.",
                "data": {
                    "shop": {
                        "id": response.json()["data"]["shop"]["id"],
                        "name": "New Grocery",
                    },
                    "owner": {"username": "newowner"},
                    "verification_required": True,
                    "owner_email": "new-owner@example.test",
                    "registration_status": "PENDING_VERIFICATION",
                    "email_delivery": "EMAIL_SENT",
                    "next_step": "VERIFY_EMAIL",
                },
            },
        )
        self.assertNotIn("password", str(response.json()).lower())
        self.assertNotIn("token", str(response.json()).lower())
        self.assertNotIn("session", str(response.json()).lower())
        self.assertEqual(Shop.objects.count(), initial_counts["shops"] + 1)
        self.assertEqual(User.objects.count(), initial_counts["users"] + 1)
        self.assertEqual(
            ShopSubscription.objects.count(), initial_counts["subscriptions"] + 1
        )
        self.assertEqual(
            EmailVerificationToken.objects.count(), initial_counts["tokens"] + 1
        )
        shop = Shop.objects.get(name="New Grocery")
        self.assertEqual(response.json()["data"]["shop"]["id"], str(shop.id))
        self.assertNotEqual(response.json()["data"]["shop"]["id"], str(self.shop.id))
        owner = shop.primary_owner
        self.assertTrue(owner.check_password(PASSWORD))
        self.assertFalse(owner.is_superuser)
        self.assertEqual(shop.status, Shop.Status.PENDING_VERIFICATION)
        self.assertEqual(shop.subscription.status, ShopSubscription.Status.TRIAL)
        self.assertEqual(
            (shop.subscription.trial_ends_at - shop.subscription.trial_started_at).days,
            14,
        )
        token = token_from_email(mail.outbox[0].body)
        self.assertEqual(mail.outbox[0].to, [owner.email])
        self.assertIn(str(shop.id), mail.outbox[0].body)
        self.assertIn(shop.name, mail.outbox[0].body)
        self.assertIn(owner.username, mail.outbox[0].body)
        self.assertIn("expires in 24 hours", mail.outbox[0].body)
        self.assertNotIn(PASSWORD, mail.outbox[0].body)
        self.assertNotEqual(
            EmailVerificationToken.objects.get(user=owner).token_hash, token
        )

    def test_registration_rejects_duplicate_email_and_rolls_back_invalid_password(self):
        base = {
            "shop_name": "Rejected Grocery",
            "owner_full_name": "Rejected Owner",
            "owner_email": self.owner.email,
            "owner_username": "rejected",
            "password": PASSWORD,
            "password_confirm": PASSWORD,
            "address": "Doha",
            "phone": "+97450000003",
        }
        self.assertEqual(
            self.public_post(reverse("saas_api:register"), base).status_code, 400
        )
        base["owner_email"] = "unique@example.test"
        base["password"] = base["password_confirm"] = "short"
        self.assertEqual(
            self.public_post(reverse("saas_api:register"), base).status_code, 400
        )
        self.assertFalse(Shop.objects.filter(name="Rejected Grocery").exists())

    def test_duplicate_registration_creates_no_additional_records(self):
        payload = {
            "shop_name": "Duplicate Grocery",
            "owner_full_name": "Duplicate Owner",
            "owner_email": "duplicate@example.test",
            "owner_username": "duplicate",
            "password": PASSWORD,
            "password_confirm": PASSWORD,
            "address": "Doha",
            "phone": "+97450000004",
        }
        self.assertEqual(
            self.public_post(reverse("saas_api:register"), payload).status_code,
            201,
        )
        counts = (
            Shop.objects.count(),
            User.objects.count(),
            ShopSubscription.objects.count(),
            EmailVerificationToken.objects.count(),
        )
        duplicate = self.public_post(reverse("saas_api:register"), payload)
        self.assertEqual(duplicate.status_code, 400)
        self.assertNotIn("shop", duplicate.json().get("errors", {}))
        self.assertEqual(
            (
                Shop.objects.count(),
                User.objects.count(),
                ShopSubscription.objects.count(),
                EmailVerificationToken.objects.count(),
            ),
            counts,
        )

    def test_shop_registration_email_has_database_duplicate_protection(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Shop.objects.create(
                    name="Conflicting Registration",
                    address="Doha",
                    phone="+97450000006",
                    email=self.shop.email.upper(),
                )

    def test_registration_remains_recoverable_when_verification_email_fails(self):
        payload = {
            "shop_name": "Email Failure Grocery",
            "owner_full_name": "Email Failure Owner",
            "owner_email": "email-failure@example.test",
            "owner_username": "email-failure",
            "password": PASSWORD,
            "password_confirm": PASSWORD,
            "address": "Doha",
            "phone": "+97450000005",
        }
        with self.settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend"):
            with mock.patch.object(
                EmailMessage, "send", side_effect=RuntimeError("email unavailable")
            ):
                response = self.public_post(reverse("saas_api:register"), payload)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            response.json()["data"]["email_delivery"], "EMAIL_DELIVERY_FAILED"
        )
        self.assertIn("shop was created", response.json()["message"])
        shop = Shop.objects.get(name="Email Failure Grocery")
        self.assertEqual(shop.status, Shop.Status.PENDING_VERIFICATION)
        self.assertEqual(shop.users.count(), 1)
        self.assertTrue(ShopSubscription.objects.filter(shop=shop).exists())
        self.assertEqual(
            EmailVerificationToken.objects.filter(user__shop=shop).count(), 1
        )
        self.assertNotIn("token", str(response.json()).lower())

    def test_verification_is_one_time_hashed_and_advances_lifecycle(self):
        self.test_registration_is_atomic_and_creates_hashed_owner_trial_and_token()
        raw = token_from_email(mail.outbox[0].body)
        verify_path = "/api/v1/auth/email-verification/verify/"
        first = self.public_post(verify_path, {"token": raw})
        second = self.public_post(verify_path, {"token": raw})
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 400)
        self.assertEqual(second.json()["code"], "VERIFICATION_TOKEN_USED")
        shop = Shop.objects.get(name="New Grocery")
        self.assertEqual(
            first.json()["data"],
            {"shop": {"id": str(shop.id), "name": shop.name}},
        )
        self.assertNotIn(str(self.shop.id), str(first.json()))
        self.assertNotIn("shop", second.json().get("errors", {}))
        self.assertEqual(shop.status, Shop.Status.ONBOARDING)
        self.assertIsNotNone(shop.primary_owner.email_verified_at)

    def test_registration_verification_and_first_login_flow(self):
        self.test_registration_is_atomic_and_creates_hashed_owner_trial_and_token()
        shop = Shop.objects.get(name="New Grocery")
        credentials = {
            "shop_id": str(shop.id),
            "username": "  NEWOWNER  ",
            "password": PASSWORD,
        }
        before = self.public_post("/api/v1/auth/login/", credentials)
        self.assertEqual(before.status_code, 403)
        self.assertEqual(before.json()["code"], "EMAIL_NOT_VERIFIED")
        self.assertNotIn("_auth_user_id", self.client.session)

        raw = token_from_email(mail.outbox[0].body)
        verified = self.public_post(
            "/api/v1/auth/email-verification/verify/",
            {"token": raw},
        )
        self.assertEqual(verified.status_code, 200)
        after = self.public_post("/api/v1/auth/login/", credentials)
        self.assertEqual(after.status_code, 200)
        self.assertIn("_auth_user_id", self.client.session)
        self.assertEqual(
            after.json()["data"]["user"]["shop"]["status"],
            Shop.Status.ONBOARDING,
        )
        self.assertFalse(
            after.json()["data"]["user"]["shop"]["onboarding_completed"]
        )

    def test_verification_resend_is_generic(self):
        path = "/api/v1/auth/email-verification/resend/"
        unknown = self.public_post(path, {"email": "missing@example.test"})
        known = self.public_post(path, {"email": self.owner.email})
        self.assertEqual(unknown.status_code, known.status_code)
        self.assertEqual(unknown.json()["message"], known.json()["message"])
        self.assertNotIn("token", str(known.json()).lower())

    def test_login_context_resend_supersedes_token_and_skips_verified_user(self):
        self.test_registration_is_atomic_and_creates_hashed_owner_trial_and_token()
        shop = Shop.objects.get(name="New Grocery")
        owner = shop.primary_owner
        original = EmailVerificationToken.objects.get(user=owner)
        original_raw = token_from_email(mail.outbox[0].body)
        response = self.public_post(
            "/api/v1/auth/email-verification/resend/",
            {"shop_id": str(shop.id), "username": "  NEWOWNER  "},
        )
        self.assertEqual(response.status_code, 200)
        original.refresh_from_db()
        self.assertIsNotNone(original.used_at)
        self.assertEqual(
            EmailVerificationToken.objects.filter(
                user=owner, used_at__isnull=True
            ).count(),
            1,
        )
        replaced = self.public_post(
            "/api/v1/auth/email-verification/verify/",
            {"token": original_raw},
        )
        self.assertEqual(replaced.status_code, 400)
        self.assertEqual(
            replaced.json()["code"], "VERIFICATION_TOKEN_REPLACED"
        )
        latest_raw = token_from_email(mail.outbox[-1].body)
        latest = self.public_post(
            "/api/v1/auth/email-verification/verify/",
            {"token": latest_raw},
        )
        self.assertEqual(latest.status_code, 200)

        owner.refresh_from_db()
        token_count = EmailVerificationToken.objects.filter(user=owner).count()
        verified_response = self.public_post(
            "/api/v1/auth/email-verification/resend/",
            {"shop_id": str(shop.id), "username": owner.username},
        )
        self.assertEqual(verified_response.status_code, 200)
        self.assertEqual(
            EmailVerificationToken.objects.filter(user=owner).count(),
            token_count,
        )

    def test_expired_and_invalid_verification_tokens_are_rejected(self):
        EmailVerificationToken.objects.create(
            user=self.owner,
            token_hash=hash_token("expired-verification"),
            expires_at=timezone.now() - timedelta(minutes=1),
        )
        path = "/api/v1/auth/email-verification/verify/"
        expired = self.public_post(path, {"token": "expired-verification"})
        invalid = self.public_post(path, {"token": "invalid-verification"})
        self.assertEqual(expired.status_code, 400)
        self.assertEqual(expired.json()["code"], "VERIFICATION_TOKEN_EXPIRED")
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(invalid.json()["code"], "INVALID_VERIFICATION_TOKEN")

    def test_primary_owner_and_owner_invitation_permissions_and_hashing(self):
        self.client.force_login(self.owner)
        owner_invite = self.client.post(
            "/api/v1/users/invitations/",
            {"email": "other-owner@example.test", "role": "OWNER"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=self.csrf(),
        )
        self.assertEqual(owner_invite.status_code, 201)
        invitation = ShopInvitation.objects.get(email="other-owner@example.test")
        raw = token_from_email(mail.outbox[-1].body)
        self.assertEqual(invitation.token_hash, hash_token(raw))
        self.assertNotIn("token", owner_invite.json()["data"])

        normal_owner = User.objects.create_user(
            shop=self.shop,
            username="normalowner",
            password=PASSWORD,
            full_name="Normal Owner",
            role=User.Role.OWNER,
        )
        self.client.force_login(normal_owner)
        denied = self.client.post(
            "/api/v1/users/invitations/",
            {"email": "denied@example.test", "role": "OWNER"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=self.csrf(),
        )
        self.assertEqual(denied.status_code, 403)
        allowed = self.client.post(
            "/api/v1/users/invitations/",
            {"email": "cashier@example.test", "role": "CASHIER"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=self.csrf(),
        )
        self.assertEqual(allowed.status_code, 201)
        User.objects.create_user(
            shop=self.shop,
            username="seat-three",
            password=PASSWORD,
            full_name="Seat Three",
            role=User.Role.CASHIER,
        )
        limited = self.client.post(
            "/api/v1/users/invitations/",
            {"email": "over-limit@example.test", "role": "CASHIER"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=self.csrf(),
        )
        self.assertEqual(limited.status_code, 400)

    def test_invitation_acceptance_one_time_and_cross_shop_safe(self):
        invitation = create_invitation(
            actor=self.owner, email="cashier@example.test", role=User.Role.CASHIER
        )
        raw = token_from_email(mail.outbox[-1].body)
        user = accept_invitation(
            raw_token=raw,
            full_name="Invited Cashier",
            username="invited",
            password=PASSWORD,
        )
        self.assertEqual(user.shop, self.shop)
        self.assertTrue(user.check_password(PASSWORD))
        with self.assertRaises(SaasOperationError):
            accept_invitation(
                raw_token=raw,
                full_name="Again",
                username="again",
                password=PASSWORD,
            )
        self.assertEqual(invitation.shop_id, user.shop_id)

    def test_invitation_reactivates_matching_inactive_shop_user(self):
        inactive = User.objects.create_user(
            shop=self.shop,
            username="former",
            password=PASSWORD,
            full_name="Former User",
            email="returning@example.test",
            is_active=False,
        )
        invitation = create_invitation(
            actor=self.owner,
            email="returning@example.test",
            role=User.Role.CASHIER,
        )
        accepted = accept_invitation(
            raw_token=token_from_email(mail.outbox[-1].body),
            full_name="Returning User",
            username="returning",
            password=NEW_PASSWORD,
        )
        self.assertEqual(accepted.id, inactive.id)
        self.assertTrue(accepted.is_active)
        self.assertTrue(accepted.check_password(NEW_PASSWORD))
        self.assertEqual(invitation.shop_id, accepted.shop_id)

    def test_invitation_expired_revoked_duplicate_and_limit(self):
        invitation = create_invitation(
            actor=self.owner, email="pending@example.test", role=User.Role.CASHIER
        )
        with self.assertRaises(SaasOperationError):
            create_invitation(
                actor=self.owner,
                email="PENDING@example.test",
                role=User.Role.CASHIER,
            )
        invitation.revoked_at = timezone.now()
        invitation.save()
        with self.assertRaises(SaasOperationError):
            accept_invitation(
                raw_token=token_from_email(mail.outbox[-1].body),
                full_name="No",
                username="no",
                password=PASSWORD,
            )
        expired = create_invitation(
            actor=self.owner, email="expired@example.test", role=User.Role.CASHIER
        )
        ShopInvitation.objects.filter(pk=expired.pk).update(
            created_at=timezone.now() - timedelta(days=2),
            expires_at=timezone.now() - timedelta(days=1),
        )
        with self.assertRaises(SaasOperationError):
            accept_invitation(
                raw_token=token_from_email(mail.outbox[-1].body),
                full_name="Expired",
                username="expired",
                password=PASSWORD,
            )

    def test_team_is_shop_scoped_and_cashier_denied(self):
        other = Shop.objects.create(name="Other", address="Doha", phone="2")
        User.objects.create_user(
            shop=other,
            username="other",
            password=PASSWORD,
            full_name="Other",
        )
        self.client.force_login(self.owner)
        response = self.client.get("/api/v1/users/")
        self.assertEqual(response.status_code, 200)
        ids = {row["id"] for row in response.json()["data"]["results"]}
        self.assertEqual(ids, {str(self.owner.id)})
        cashier = User.objects.create_user(
            shop=self.shop,
            username="cashier",
            password=PASSWORD,
            full_name="Cashier",
        )
        self.client.force_login(cashier)
        self.assertEqual(self.client.get("/api/v1/users/").status_code, 403)

    def test_direct_staff_creation_hashes_password_and_requires_change(self):
        self.client.force_login(self.owner)
        response = self.client.post(
            "/api/v1/team/users/",
            {
                "full_name": "Shop Cashier",
                "username": "ShopCashier",
                "email": "",
                "role": "CASHIER",
                "temporary_password": NEW_PASSWORD,
                "temporary_password_confirm": NEW_PASSWORD,
            },
            content_type="application/json",
            HTTP_X_CSRFTOKEN=self.csrf(),
        )
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(shop=self.shop, username="shopcashier")
        self.assertTrue(user.check_password(NEW_PASSWORD))
        self.assertTrue(user.must_change_password)
        self.assertEqual(user.created_by, self.owner)
        self.assertNotIn("password", response.json()["data"])

    def test_owner_can_only_create_and_manage_cashiers(self):
        normal_owner = User.objects.create_user(
            shop=self.shop, username="manager", password=PASSWORD,
            full_name="Manager", role=User.Role.OWNER,
        )
        cashier = create_staff_user(
            actor=normal_owner, full_name="Cashier", username="managed",
            temporary_password=NEW_PASSWORD, role=User.Role.CASHIER,
        )
        self.assertEqual(cashier.role, User.Role.CASHIER)
        with self.assertRaises(PermissionDenied):
            create_staff_user(
                actor=normal_owner, full_name="Owner", username="forbidden-owner",
                temporary_password=NEW_PASSWORD, role=User.Role.OWNER,
            )

    def test_team_filters_and_cross_shop_detail_is_hidden(self):
        create_staff_user(
            actor=self.owner, full_name="Filtered Cashier", username="filtered",
            temporary_password=NEW_PASSWORD, role=User.Role.CASHIER,
        )
        other_shop = Shop.objects.create(name="Separate", address="Doha", phone="9")
        outsider = User.objects.create_user(
            shop=other_shop, username="outside", password=PASSWORD, full_name="Outside",
        )
        self.client.force_login(self.owner)
        filtered = self.client.get(
            "/api/v1/team/users/?search=filtered&role=CASHIER&status=PASSWORD_CHANGE_REQUIRED"
        )
        self.assertEqual(filtered.status_code, 200)
        self.assertEqual(len(filtered.json()["data"]["results"]), 1)
        self.assertEqual(
            self.client.get(f"/api/v1/team/users/{outsider.id}/").status_code, 404
        )

    def test_password_reset_requires_change_and_ends_target_sessions(self):
        cashier = User.objects.create_user(
            shop=self.shop, username="reset-me", password=PASSWORD,
            full_name="Reset Me", role=User.Role.CASHIER,
        )
        other_client = Client()
        other_client.force_login(cashier)
        self.assertTrue(other_client.session.session_key)
        reset_staff_password(
            actor=self.owner, target=cashier, temporary_password=NEW_PASSWORD
        )
        cashier.refresh_from_db()
        self.assertTrue(cashier.must_change_password)
        self.assertTrue(cashier.check_password(NEW_PASSWORD))
        self.assertNotIn("_auth_user_id", other_client.session)

    def test_temporary_password_session_is_restricted_until_change(self):
        cashier = create_staff_user(
            actor=self.owner, full_name="First Login", username="first-login",
            temporary_password=PASSWORD, role=User.Role.CASHIER,
        )
        csrf_token = self.csrf()
        self.client.force_login(cashier)
        blocked = self.client.get("/api/v1/products/")
        self.assertEqual(blocked.status_code, 403)
        self.assertEqual(blocked.json()["code"], "PASSWORD_CHANGE_REQUIRED")
        allowed = self.client.get("/api/v1/auth/me/")
        self.assertEqual(allowed.status_code, 200)
        self.assertTrue(allowed.json()["data"]["user"]["must_change_password"])
        changed = self.client.post(
            "/api/v1/auth/change-password/",
            {
                "current_password": PASSWORD,
                "new_password": NEW_PASSWORD,
                "confirm_password": NEW_PASSWORD,
            },
            content_type="application/json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(changed.status_code, 200)
        cashier.refresh_from_db()
        self.assertFalse(cashier.must_change_password)

    def test_primary_owner_and_self_deactivation_are_protected(self):
        with self.assertRaises(SaasOperationError):
            set_user_active(actor=self.owner, target=self.owner, active=False)
        normal = User.objects.create_user(
            shop=self.shop,
            username="cashier",
            password=PASSWORD,
            full_name="Cashier",
        )
        set_user_active(actor=self.owner, target=normal, active=False)
        self.assertFalse(normal.is_active)

    def test_role_change_policy_protects_primary_owner_and_normal_owner_scope(self):
        normal_owner = User.objects.create_user(
            shop=self.shop,
            username="normal-owner",
            password=PASSWORD,
            full_name="Normal Owner",
            role=User.Role.OWNER,
        )
        cashier = User.objects.create_user(
            shop=self.shop,
            username="role-cashier",
            password=PASSWORD,
            full_name="Role Cashier",
        )
        from .services import update_user_role

        with self.assertRaises(SaasOperationError):
            update_user_role(
                actor=self.owner, target=self.owner, role=User.Role.CASHIER
            )
        from rest_framework.exceptions import PermissionDenied

        with self.assertRaises(PermissionDenied):
            update_user_role(
                actor=normal_owner, target=cashier, role=User.Role.OWNER
            )

    def test_onboarding_primary_only_resumes_and_completes(self):
        self.shop.status = Shop.Status.ONBOARDING
        self.shop.onboarding_completed_at = None
        self.shop.save()
        self.client.force_login(self.owner)
        patch = self.client.patch(
            "/api/v1/saas/onboarding/",
            {"city": "Doha", "next_step": 4},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=self.csrf(),
        )
        self.assertEqual(patch.status_code, 200)
        self.assertEqual(patch.json()["data"]["current_step"], 4)
        complete = self.client.post(
            "/api/v1/saas/onboarding/complete/",
            {},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=self.csrf(),
        )
        self.assertEqual(complete.status_code, 200)
        self.shop.refresh_from_db()
        self.assertEqual(self.shop.status, Shop.Status.TRIAL)

    def test_subscription_one_per_shop_and_usage_limits(self):
        from django.db import transaction

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                ShopSubscription.objects.create(shop=self.shop, plan=self.plan)
        Product.objects.create(
            shop=self.shop,
            name="One",
            sku="ONE",
            unit="PIECE",
            purchase_price=1,
            selling_price=2,
        )
        Product.objects.create(
            shop=self.shop,
            name="Two",
            sku="TWO",
            unit="PIECE",
            purchase_price=1,
            selling_price=2,
        )
        from apps.saas.services import enforce_product_limit

        with self.assertRaises(SaasOperationError):
            enforce_product_limit(self.shop)

    def test_suspended_blocks_mutations_but_preserves_safe_owner_read(self):
        invitation = create_invitation(
            actor=self.owner, email="before-suspension@example.test", role=User.Role.CASHIER
        )
        raw = token_from_email(mail.outbox[-1].body)
        transition_subscription(
            subscription=self.subscription,
            status=ShopSubscription.Status.SUSPENDED,
        )
        self.client.force_login(self.owner)
        self.assertEqual(self.client.get("/api/v1/products/").status_code, 200)
        denied = self.client.post(
            "/api/v1/categories/",
            {"name": "Blocked"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=self.csrf(),
        )
        self.assertEqual(denied.status_code, 403)
        self.assertEqual(self.client.get("/api/v1/saas/subscription/").status_code, 200)
        with self.assertRaises(SaasOperationError):
            accept_invitation(
                raw_token=raw,
                full_name="Blocked",
                username="blocked",
                password=PASSWORD,
            )
        self.assertIsNone(invitation.accepted_at)

    def test_password_reset_generic_hashed_one_time_and_invalidates_session(self):
        path = "/api/v1/auth/password-reset/request/"
        unknown = self.public_post(path, {"email": "unknown@example.test"})
        known = self.public_post(path, {"email": self.owner.email})
        self.assertEqual(unknown.json()["message"], known.json()["message"])
        raw = token_from_email(mail.outbox[-1].body)
        token = PasswordResetToken.objects.get(user=self.owner)
        self.assertEqual(token.token_hash, hash_token(raw))
        confirm_path = "/api/v1/auth/password-reset/confirm/"
        first = self.public_post(
            confirm_path,
            {
                "token": raw,
                "new_password": NEW_PASSWORD,
                "confirm_password": NEW_PASSWORD,
            },
        )
        second = self.public_post(
            confirm_path,
            {
                "token": raw,
                "new_password": PASSWORD,
                "confirm_password": PASSWORD,
            },
        )
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 400)
        self.owner.refresh_from_db()
        self.assertTrue(self.owner.check_password(NEW_PASSWORD))

    def test_expired_password_reset_is_rejected(self):
        PasswordResetToken.objects.create(
            user=self.owner,
            token_hash=hash_token("expired"),
            expires_at=timezone.now() - timedelta(minutes=1),
        )
        response = self.public_post(
            "/api/v1/auth/password-reset/confirm/",
            {
                "token": "expired",
                "new_password": NEW_PASSWORD,
                "confirm_password": NEW_PASSWORD,
            },
        )
        self.assertEqual(response.status_code, 400)


@override_settings(REQUIRE_EMAIL_VERIFICATION=False)
class DevelopmentRegistrationTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)

    def public_post(self, path, data):
        csrf = self.client.get(reverse("accounts_api:csrf")).cookies[
            "csrftoken"
        ].value
        return self.client.post(
            path,
            data,
            content_type="application/json",
            HTTP_X_CSRFTOKEN=csrf,
        )

    @staticmethod
    def payload(**overrides):
        data = {
            "shop_name": "Immediate Login Grocery",
            "owner_full_name": "Development Owner",
            "owner_email": "development-owner@example.test",
            "owner_username": " DevOwner ",
            "password": PASSWORD,
            "password_confirm": PASSWORD,
            "address": "Doha",
            "phone": "+97450000900",
            "country": "Qatar",
            "timezone": "Asia/Qatar",
            "currency": "QAR",
        }
        data.update(overrides)
        return data

    def test_registration_is_login_ready_without_token_or_email(self):
        before = (
            Shop.objects.count(),
            User.objects.count(),
            ShopSubscription.objects.count(),
        )
        response = self.public_post(
            reverse("saas_api:register"), self.payload()
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()["data"]
        self.assertFalse(data["verification_required"])
        self.assertEqual(data["next_step"], "SIGN_IN")
        self.assertEqual(data["email_delivery"], "NOT_REQUIRED")
        self.assertEqual(data["owner"]["username"], "devowner")
        self.assertNotIn("password", str(response.json()).lower())
        self.assertNotIn("token", str(response.json()).lower())

        shop = Shop.objects.get(pk=data["shop"]["id"])
        owner = shop.primary_owner
        self.assertEqual(shop.status, Shop.Status.ONBOARDING)
        self.assertTrue(owner.is_active)
        self.assertIsNotNone(owner.email_verified_at)
        self.assertFalse(
            EmailVerificationToken.objects.filter(user=owner).exists()
        )
        self.assertEqual(
            (
                Shop.objects.count(),
                User.objects.count(),
                ShopSubscription.objects.count(),
            ),
            tuple(value + 1 for value in before),
        )

        login_response = self.public_post(
            "/api/v1/auth/login/",
            {
                "shop_id": f"  {shop.id}  ",
                "username": "  DEVOWNER ",
                "password": PASSWORD,
            },
        )
        self.assertEqual(login_response.status_code, 200)
        self.assertIn("_auth_user_id", self.client.session)
        user_data = login_response.json()["data"]["user"]
        self.assertFalse(user_data["email_verification_required"])
        self.assertEqual(user_data["shop"]["status"], Shop.Status.ONBOARDING)

    def test_invalid_and_duplicate_submissions_create_no_partial_tenant(self):
        counts = (
            Shop.objects.count(),
            User.objects.count(),
            ShopSubscription.objects.count(),
        )
        invalid = self.public_post(
            reverse("saas_api:register"),
            self.payload(
                shop_name="Invalid Development Grocery",
                owner_email="invalid-development@example.test",
                password="short",
                password_confirm="short",
            ),
        )
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(
            (
                Shop.objects.count(),
                User.objects.count(),
                ShopSubscription.objects.count(),
            ),
            counts,
        )

        first = self.public_post(reverse("saas_api:register"), self.payload())
        self.assertEqual(first.status_code, 201)
        after_first = (
            Shop.objects.count(),
            User.objects.count(),
            ShopSubscription.objects.count(),
        )
        duplicate = self.public_post(
            reverse("saas_api:register"), self.payload()
        )
        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(duplicate.json()["code"], "ACCOUNT_MAY_EXIST")
        self.assertEqual(
            (
                Shop.objects.count(),
                User.objects.count(),
                ShopSubscription.objects.count(),
            ),
            after_first,
        )
