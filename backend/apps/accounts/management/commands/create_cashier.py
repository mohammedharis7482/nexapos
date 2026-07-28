import getpass

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.models import User
from apps.shops.models import Shop
from apps.saas.services import SaasOperationError, enforce_user_limit


class Command(BaseCommand):
    help = "Create one cashier for an existing active shop using a secure prompt."

    def add_arguments(self, parser):
        parser.add_argument("--shop-id", required=True)
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
        try:
            shop = Shop.objects.get(pk=options["shop_id"])
        except (Shop.DoesNotExist, ValueError) as exc:
            raise CommandError("The specified shop does not exist.") from exc
        if not shop.is_active:
            raise CommandError("Cashiers cannot be created for an inactive shop.")
        try:
            enforce_user_limit(shop)
        except SaasOperationError as exc:
            raise CommandError(exc.message) from exc

        username = User.objects.normalize_username(options["username"])
        full_name = options["full_name"].strip()
        email = options["email"].strip()
        if not full_name:
            raise CommandError("Full name is required.")
        if User.objects.filter(shop=shop, username__iexact=username).exists():
            raise CommandError(
                "A user with this username already exists in the selected shop."
            )

        password = self._prompt_password()
        prospective_user = User(
            shop=shop,
            username=username,
            full_name=full_name,
            email=email,
            role=User.Role.CASHIER,
        )
        try:
            validate_password(password, user=prospective_user)
        except ValidationError as exc:
            raise CommandError(" ".join(exc.messages)) from exc

        with transaction.atomic():
            if User.objects.select_for_update().filter(
                shop=shop,
                username__iexact=username,
            ).exists():
                raise CommandError(
                    "A user with this username already exists in the selected shop."
                )
            cashier = User.objects.create_user(
                shop=shop,
                username=username,
                password=password,
                full_name=full_name,
                email=email,
                role=User.Role.CASHIER,
                is_active=True,
            )

        self.stdout.write(self.style.SUCCESS("Cashier created successfully."))
        self.stdout.write(f"Shop: {shop.name}")
        self.stdout.write(f"Shop UUID: {shop.id}")
        self.stdout.write(f"Username: {cashier.username}")
        self.stdout.write(f"Full name: {cashier.full_name}")
        self.stdout.write(f"Role: {cashier.role}")
