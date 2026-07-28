import getpass

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.shops.models import Shop
from apps.saas.models import ShopSubscription
from apps.saas.services import get_default_plan


class Command(BaseCommand):
    help = "Create one shop and its first owner using a securely prompted password."

    def add_arguments(self, parser):
        parser.add_argument("--shop-name", required=True)
        parser.add_argument("--address", required=True)
        parser.add_argument("--phone", required=True)
        parser.add_argument("--username", required=True)
        parser.add_argument("--full-name", required=True)
        parser.add_argument("--email", default="")

    def _prompt_password(self) -> str:
        password = getpass.getpass("Password: ")
        confirmation = getpass.getpass("Password (again): ")
        if not password:
            raise CommandError("Password cannot be empty.")
        if password != confirmation:
            raise CommandError("Passwords do not match.")
        return password

    def handle(self, *args, **options):
        shop_name = options["shop_name"].strip()
        username = User.objects.normalize_username(options["username"])

        password = self._prompt_password()
        prospective_user = User(
            username=username,
            full_name=options["full_name"].strip(),
            email=options["email"].strip(),
            role=User.Role.OWNER,
        )
        try:
            validate_password(password, user=prospective_user)
        except ValidationError as exc:
            raise CommandError(" ".join(exc.messages)) from exc

        with transaction.atomic():
            if Shop.objects.filter(name__iexact=shop_name).exists():
                raise CommandError(
                    "A shop with this name already exists; no records were created."
                )

            shop = Shop.objects.create(
                name=shop_name,
                address=options["address"].strip(),
                phone=options["phone"].strip(),
            )
            owner = User.objects.create_user(
                shop=shop,
                username=username,
                password=password,
                full_name=prospective_user.full_name,
                email=prospective_user.email,
                role=User.Role.OWNER,
            )
            shop.primary_owner = owner
            shop.onboarding_current_step = 7
            shop.onboarding_completed_at = timezone.now()
            shop.activated_at = shop.onboarding_completed_at
            shop.status = Shop.Status.ACTIVE
            shop.save()
            ShopSubscription.objects.create(
                shop=shop,
                plan=get_default_plan(),
                status=ShopSubscription.Status.ACTIVE,
                current_period_start=shop.activated_at,
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Created shop '{shop.name}' and owner '{owner.username}'."
            )
        )
