from datetime import timedelta
from decimal import Decimal

from django.db import migrations
from django.utils import timezone


def bootstrap_existing_shops(apps, schema_editor):
    Shop = apps.get_model("shops", "Shop")
    User = apps.get_model("accounts", "User")
    Plan = apps.get_model("saas", "Plan")
    ShopSubscription = apps.get_model("saas", "ShopSubscription")
    now = timezone.now()
    plan, _ = Plan.objects.get_or_create(
        code="STARTER",
        defaults={
            "name": "Starter",
            "description": "Example entry plan; commercial terms are pending.",
            "is_active": True,
            "monthly_price": Decimal("0.00"),
            "yearly_price": Decimal("0.00"),
            "currency": "QAR",
            "trial_days": 14,
            "max_users": 3,
            "max_products": 500,
            "reports_enabled": True,
            "advanced_reports_enabled": False,
        },
    )
    for shop in Shop.objects.all().iterator():
        owner = (
            User.objects.filter(shop_id=shop.id, role="OWNER", is_active=True)
            .order_by("date_joined", "id")
            .first()
        )
        if owner and shop.primary_owner_id is None:
            shop.primary_owner_id = owner.id
        shop.status = "ACTIVE"
        shop.is_active = True
        shop.onboarding_current_step = 7
        shop.onboarding_completed_at = shop.onboarding_completed_at or now
        shop.activated_at = shop.activated_at or now
        shop.save(
            update_fields=[
                "primary_owner",
                "status",
                "is_active",
                "onboarding_current_step",
                "onboarding_completed_at",
                "activated_at",
                "updated_at",
            ]
        )
        ShopSubscription.objects.get_or_create(
            shop_id=shop.id,
            defaults={
                "plan_id": plan.id,
                "status": "ACTIVE",
                "current_period_start": now,
                "current_period_end": now + timedelta(days=30),
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_user_activated_at_user_deactivated_at_and_more"),
        ("saas", "0001_initial"),
    ]

    operations = [
        # Reversing this data bootstrap must not delete subscriptions or
        # primary-owner assignments that may have changed after deployment.
        migrations.RunPython(bootstrap_existing_shops, migrations.RunPython.noop),
    ]
