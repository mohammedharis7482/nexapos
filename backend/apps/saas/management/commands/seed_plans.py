from decimal import Decimal

from django.core.management.base import BaseCommand

from apps.saas.models import Plan


PLANS = (
    {
        "code": "STARTER",
        "name": "Starter",
        "description": "Example entry plan for a small grocery team.",
        "trial_days": 14,
        "max_users": 3,
        "max_products": 500,
        "reports_enabled": True,
        "advanced_reports_enabled": False,
    },
    {
        "code": "GROWTH",
        "name": "Growth",
        "description": "Example plan for a growing grocery operation.",
        "trial_days": 14,
        "max_users": 10,
        "max_products": 5000,
        "reports_enabled": True,
        "advanced_reports_enabled": True,
    },
    {
        "code": "PRO",
        "name": "Pro",
        "description": "Example higher-capacity plan; commercial terms are pending.",
        "trial_days": 14,
        "max_users": 25,
        "max_products": 20000,
        "reports_enabled": True,
        "advanced_reports_enabled": True,
    },
)


class Command(BaseCommand):
    help = "Create missing example SaaS plans without overwriting existing plans."

    def handle(self, *args, **options):
        created = 0
        for definition in PLANS:
            _, was_created = Plan.objects.get_or_create(
                code=definition["code"],
                defaults={
                    **definition,
                    "monthly_price": Decimal("0.00"),
                    "yearly_price": Decimal("0.00"),
                    "currency": "QAR",
                },
            )
            created += int(was_created)
        self.stdout.write(
            self.style.SUCCESS(
                f"Plan seed complete: {created} created, {len(PLANS) - created} unchanged."
            )
        )
