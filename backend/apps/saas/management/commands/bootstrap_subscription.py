from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.saas.models import Plan, ShopSubscription
from apps.shops.models import Shop


class Command(BaseCommand):
    help = "Idempotently prepare one existing shop for the SaaS foundation."

    def add_arguments(self, parser):
        parser.add_argument("--shop-id", required=True)
        parser.add_argument("--plan-code", default="STARTER")

    @transaction.atomic
    def handle(self, *args, **options):
        try:
            shop = Shop.objects.select_for_update().get(pk=options["shop_id"])
            plan = Plan.objects.get(code=options["plan_code"].upper(), is_active=True)
        except (Shop.DoesNotExist, Plan.DoesNotExist, ValueError) as exc:
            raise CommandError("The shop or active plan could not be found.") from exc
        owner = (
            User.objects.filter(shop=shop, role=User.Role.OWNER, is_active=True)
            .order_by("date_joined", "id")
            .first()
        )
        if owner is None:
            raise CommandError("The shop must have an active owner.")
        now = timezone.now()
        changed = []
        if shop.primary_owner_id is None:
            shop.primary_owner = owner
            changed.append("primary_owner")
        if shop.onboarding_completed_at is None:
            shop.onboarding_completed_at = now
            shop.onboarding_current_step = 7
            changed.extend(["onboarding_completed_at", "onboarding_current_step"])
        shop.status = Shop.Status.ACTIVE
        shop.is_active = True
        changed.extend(["status", "is_active"])
        shop.save(update_fields=[*set(changed), "updated_at"])
        ShopSubscription.objects.get_or_create(
            shop=shop,
            defaults={
                "plan": plan,
                "status": ShopSubscription.Status.ACTIVE,
                "current_period_start": now,
                "current_period_end": now + timedelta(days=30),
            },
        )
        self.stdout.write(self.style.SUCCESS("Shop SaaS foundation is ready."))
