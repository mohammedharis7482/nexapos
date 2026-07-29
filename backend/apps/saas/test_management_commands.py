from io import StringIO

from django.core.management import CommandError, call_command
from django.test import TestCase, override_settings

from apps.accounts.models import User
from apps.sales.models import Sale
from apps.shops.models import Shop

from .email_service import DeliveryStatus, configured_delivery_status
from .models import Plan, ShopSubscription

PASSWORD = "CommandSafetyPassword123!"


@override_settings(DEBUG=True)
class DevelopmentCommandTests(TestCase):
    def make_tenant(self, name: str = "Disposable Test Grocery") -> Shop:
        shop = Shop.objects.create(
            name=name,
            address="Doha",
            phone="+97450000100",
            email=f"{name.lower().replace(' ', '-')}@example.test",
            status=Shop.Status.PENDING_VERIFICATION,
        )
        owner = User.objects.create_user(
            shop=shop,
            username="test-owner",
            password=PASSWORD,
            full_name="Test Owner",
            email=shop.email,
            role=User.Role.OWNER,
        )
        shop.primary_owner = owner
        shop.save(update_fields=["primary_owner", "updated_at"])
        ShopSubscription.objects.create(
            shop=shop,
            plan=Plan.objects.get(code="STARTER"),
        )
        return shop

    def test_cleanup_is_dry_run_by_default_and_confirm_removes_empty_tenant(self):
        shop = self.make_tenant()
        output = StringIO()
        call_command("cleanup_test_tenant", shop_id=str(shop.id), stdout=output)
        self.assertIn("DRY RUN", output.getvalue())
        self.assertTrue(Shop.objects.filter(pk=shop.pk).exists())

        call_command(
            "cleanup_test_tenant",
            shop_id=str(shop.id),
            confirm=True,
            stdout=StringIO(),
        )
        self.assertFalse(Shop.objects.filter(pk=shop.pk).exists())

    def test_cleanup_refuses_business_data_without_explicit_override(self):
        shop = self.make_tenant("Business Data Test Grocery")
        Sale.objects.create(shop=shop, created_by=shop.primary_owner)
        with self.assertRaisesMessage(CommandError, "Business data exists"):
            call_command(
                "cleanup_test_tenant",
                shop_id=str(shop.id),
                confirm=True,
                stdout=StringIO(),
            )
        self.assertTrue(Shop.objects.filter(pk=shop.pk).exists())

    @override_settings(DEBUG=False)
    def test_cleanup_refuses_when_debug_is_false(self):
        shop = self.make_tenant("Protected Test Grocery")
        with self.assertRaisesMessage(CommandError, "disabled outside development"):
            call_command(
                "cleanup_test_tenant",
                shop_id=str(shop.id),
                confirm=True,
                stdout=StringIO(),
            )

    @override_settings(
        EMAIL_BACKEND="django.core.mail.backends.console.EmailBackend"
    )
    def test_console_backend_has_explicit_public_status(self):
        self.assertEqual(
            configured_delivery_status(), DeliveryStatus.CONSOLE
        )

    @override_settings(
        EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend"
    )
    def test_send_test_email_uses_configured_backend_without_token(self):
        output = StringIO()
        call_command("send_test_email", to="recipient@example.test", stdout=output)
        self.assertIn("accepted", output.getvalue())
        self.assertNotIn("token", output.getvalue().lower())

    def test_send_test_email_validates_recipient(self):
        with self.assertRaisesMessage(CommandError, "valid recipient"):
            call_command("send_test_email", to="not-an-email", stdout=StringIO())
