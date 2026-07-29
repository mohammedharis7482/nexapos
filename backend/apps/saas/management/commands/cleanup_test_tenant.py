from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import User
from apps.shops.models import Shop
from apps.saas.tenant_audit import classify_tenant, delete_test_tenant, tenant_counts


class Command(BaseCommand):
    help = "Audit or remove one explicitly selected development test tenant."

    def add_arguments(self, parser):
        group = parser.add_mutually_exclusive_group(required=True)
        group.add_argument("--shop-id")
        group.add_argument("--email")
        parser.add_argument("--confirm", action="store_true")
        parser.add_argument("--allow-business-data", action="store_true")

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("This command is disabled outside development settings.")

        if options["shop_id"]:
            shop = Shop.objects.filter(pk=options["shop_id"]).first()
        else:
            normalized = User.objects.normalize_email_address(options["email"])
            users = list(User.objects.select_related("shop").filter(
                email__iexact=normalized, role=User.Role.OWNER
            )[:2])
            if len(users) > 1:
                raise CommandError(
                    "More than one owner matches this email; use --shop-id."
                )
            shop = users[0].shop if users else None
        if shop is None:
            self.stdout.write("No matching tenant was found; nothing changed.")
            return

        counts = tenant_counts(shop)
        classification = classify_tenant(shop, counts)
        self.stdout.write(f"Shop: {shop.name}")
        self.stdout.write(f"Status: {shop.status}")
        self.stdout.write(f"Classification: {classification}")
        self.stdout.write(
            f"Primary owner: {shop.primary_owner.username if shop.primary_owner else 'Missing'}"
        )
        for field, value in counts.__dict__.items():
            self.stdout.write(f"{field.replace('_', ' ').title()}: {value}")

        if not options["confirm"]:
            self.stdout.write(self.style.WARNING("DRY RUN: no records were deleted."))
            return
        if counts.has_business_data and not options["allow_business_data"]:
            raise CommandError(
                "Business data exists. Deletion refused; review the dry run. "
                "Use --allow-business-data only for a confirmed disposable test tenant."
            )
        if counts.completed_sales and options["allow_business_data"]:
            self.stdout.write(
                self.style.WARNING(
                    "WARNING: explicit override includes completed sales and payments."
                )
            )
        deleted = delete_test_tenant(shop)
        self.stdout.write(
            self.style.SUCCESS(
                "Test tenant deleted atomically: "
                + ", ".join(f"{key}={value}" for key, value in deleted.items())
            )
        )
