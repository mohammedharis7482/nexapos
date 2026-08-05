from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.saas.management.commands.seed_plans import seed_example_plans
from apps.saas.models import ShopSubscription
from apps.saas.services import SaasOperationError, get_default_plan
from apps.shops.models import Shop

DEMO_SHOP_ID = "10000000-0000-0000-0000-000000000001"
DEMO_OWNER_ID = "10000000-0000-0000-0000-000000000002"
DEMO_USERNAME = "demo_owner"
DEMO_PASSWORD = "NexaDemo#2026"
FIXTURE_PATH = settings.BASE_DIR / "fixtures" / "demo_seed.json"


class Command(BaseCommand):
    help = (
        "Load the shared demo shop, owner login, and sample catalogue from "
        "fixtures/demo_seed.json. Safe to rerun: existing demo records are "
        "updated in place, never duplicated."
    )

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("seed_demo is available only with DEBUG=True.")

        call_command("loaddata", str(FIXTURE_PATH))

        # The fixture cannot set Shop.primary_owner itself: that field points
        # at the User row the same fixture creates, and Postgres enforces the
        # foreign key at insert time, so the shop must exist before the user
        # row that references it - loading both with primary_owner already
        # set would put the insert order the wrong way round. Patching it
        # here afterward is the one piece of related data loaddata itself
        # can't express, not a sign the fixture is incomplete.
        Shop.objects.filter(pk=DEMO_SHOP_ID).update(primary_owner_id=DEMO_OWNER_ID)

        try:
            plan = get_default_plan()
        except SaasOperationError:
            seed_example_plans()
            plan = get_default_plan()

        _subscription, created = ShopSubscription.objects.get_or_create(
            shop_id=DEMO_SHOP_ID,
            defaults={
                "plan": plan,
                "status": ShopSubscription.Status.ACTIVE,
                "current_period_start": timezone.now(),
            },
        )

        self.stdout.write(self.style.SUCCESS("Demo data ready."))
        self.stdout.write("")
        self.stdout.write(f"  Shop ID:  {DEMO_SHOP_ID}")
        self.stdout.write(f"  Username: {DEMO_USERNAME}")
        self.stdout.write(f"  Password: {DEMO_PASSWORD}")
        self.stdout.write("")
        self.stdout.write(
            "Subscription "
            + ("created." if created else "already existed; left unchanged.")
        )
