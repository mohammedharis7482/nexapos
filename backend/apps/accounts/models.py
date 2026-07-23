from typing import Any

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone

from common.models import BaseModel


class UserManager(BaseUserManager["User"]):
    use_in_migrations = True

    @staticmethod
    def normalize_username(username: str) -> str:
        return username.strip().lower()

    def _create_user(
        self,
        username: str,
        password: str | None,
        *,
        shop,
        **extra_fields: Any,
    ) -> "User":
        if not shop:
            raise ValueError("A shop is required.")
        if not username or not username.strip():
            raise ValueError("A username is required.")
        if not password:
            raise ValueError("A password is required.")

        email = extra_fields.get("email")
        if email:
            extra_fields["email"] = self.normalize_email(email)

        user = self.model(
            username=self.normalize_username(username),
            shop=shop,
            **extra_fields,
        )
        user.set_password(password)
        user.full_clean(exclude=["password"])
        user.save(using=self._db)
        return user

    def create_user(
        self,
        username: str,
        password: str | None = None,
        *,
        shop,
        **extra_fields: Any,
    ) -> "User":
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        extra_fields.setdefault("role", User.Role.CASHIER)
        return self._create_user(username, password, shop=shop, **extra_fields)

    def create_superuser(
        self,
        username: str,
        password: str | None = None,
        *,
        shop,
        **extra_fields: Any,
    ) -> "User":
        extra_fields.setdefault("role", User.Role.OWNER)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("A superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("A superuser must have is_superuser=True.")
        if extra_fields.get("role") != User.Role.OWNER:
            raise ValueError("A superuser must have the OWNER role.")

        return self._create_user(username, password, shop=shop, **extra_fields)


class User(BaseModel, AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        OWNER = "OWNER", "Owner"
        CASHIER = "CASHIER", "Cashier"

    shop = models.ForeignKey(
        "shops.Shop",
        on_delete=models.PROTECT,
        related_name="users",
    )
    full_name = models.CharField(max_length=150)
    username = models.CharField(max_length=150)
    email = models.EmailField(blank=True)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.CASHIER)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = ["shop", "full_name"]

    class Meta:
        ordering = ["shop", "username"]
        constraints = [
            models.UniqueConstraint(
                Lower("username"),
                "shop",
                name="accounts_user_shop_username_ci_uniq",
            )
        ]
        indexes = [
            models.Index(fields=["shop", "role"], name="users_shop_role_idx"),
            models.Index(fields=["shop", "is_active"], name="users_shop_active_idx"),
        ]

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.username = UserManager.normalize_username(self.username)
        if self.email:
            self.email = UserManager.normalize_email(self.email)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.username} ({self.shop.name})"
