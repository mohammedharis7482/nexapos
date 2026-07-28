from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower

from common.models import BaseModel


class Plan(BaseModel):
    code = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=80)
    description = models.CharField(max_length=240, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    monthly_price = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("0.00")
    )
    yearly_price = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("0.00")
    )
    currency = models.CharField(max_length=3, default="QAR")
    trial_days = models.PositiveSmallIntegerField(default=14)
    max_users = models.PositiveIntegerField(default=3)
    max_products = models.PositiveIntegerField(default=500)
    reports_enabled = models.BooleanField(default=True)
    advanced_reports_enabled = models.BooleanField(default=False)

    class Meta:
        ordering = ["monthly_price", "code"]
        constraints = [
            models.CheckConstraint(
                condition=Q(monthly_price__gte=0) & Q(yearly_price__gte=0),
                name="saas_plan_prices_nonnegative",
            ),
            models.CheckConstraint(
                condition=Q(max_users__gte=1) & Q(max_products__gte=1),
                name="saas_plan_limits_positive",
            ),
        ]

    def save(self, *args, **kwargs):
        self.code = self.code.strip().upper()
        self.currency = self.currency.strip().upper()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.name} ({self.code})"


class ShopSubscription(BaseModel):
    class Status(models.TextChoices):
        TRIAL = "TRIAL", "Trial"
        ACTIVE = "ACTIVE", "Active"
        PAST_DUE = "PAST_DUE", "Past due"
        SUSPENDED = "SUSPENDED", "Suspended"
        CANCELLED = "CANCELLED", "Cancelled"

    shop = models.OneToOneField(
        "shops.Shop", on_delete=models.PROTECT, related_name="subscription"
    )
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name="subscriptions")
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.TRIAL, db_index=True
    )
    trial_started_at = models.DateTimeField(null=True, blank=True)
    trial_ends_at = models.DateTimeField(null=True, blank=True, db_index=True)
    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    grace_period_ends_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=Q(trial_ends_at__isnull=True)
                | Q(trial_started_at__isnull=True)
                | Q(trial_ends_at__gte=models.F("trial_started_at")),
                name="saas_trial_dates_valid",
            )
        ]

    def __str__(self) -> str:
        return f"{self.shop.name}: {self.plan.code} ({self.status})"


class ShopInvitation(BaseModel):
    class Role(models.TextChoices):
        OWNER = "OWNER", "Owner"
        CASHIER = "CASHIER", "Cashier"

    shop = models.ForeignKey(
        "shops.Shop", on_delete=models.PROTECT, related_name="invitations"
    )
    email = models.EmailField()
    full_name = models.CharField(max_length=150, blank=True)
    role = models.CharField(max_length=10, choices=Role.choices)
    token_hash = models.CharField(max_length=64, unique=True, editable=False)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="sent_invitations",
    )
    expires_at = models.DateTimeField(db_index=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["shop", "email"], name="saas_inv_shop_email_idx"
            )
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("email"),
                "shop",
                condition=Q(accepted_at__isnull=True, revoked_at__isnull=True),
                name="saas_inv_pending_shop_email_uniq",
            ),
            models.CheckConstraint(
                condition=Q(expires_at__gt=models.F("created_at")),
                name="saas_invitation_expiry_after_create",
            )
        ]

    def save(self, *args, **kwargs):
        self.email = self.email.strip().lower()
        super().save(*args, **kwargs)

    @property
    def is_pending(self) -> bool:
        return self.accepted_at is None and self.revoked_at is None


class AccountToken(BaseModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    token_hash = models.CharField(max_length=64, unique=True, editable=False)
    expires_at = models.DateTimeField(db_index=True)
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        abstract = True
        ordering = ["-created_at"]


class EmailVerificationToken(AccountToken):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="email_verification_tokens",
    )


class PasswordResetToken(AccountToken):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="password_reset_tokens",
    )


class AuditEvent(BaseModel):
    class Event(models.TextChoices):
        SHOP_REGISTERED = "SHOP_REGISTERED", "Shop registered"
        INVITATION_SENT = "INVITATION_SENT", "Invitation sent"
        INVITATION_ACCEPTED = "INVITATION_ACCEPTED", "Invitation accepted"
        USER_ACTIVATED = "USER_ACTIVATED", "User activated"
        USER_DEACTIVATED = "USER_DEACTIVATED", "User deactivated"
        ROLE_CHANGED = "ROLE_CHANGED", "Role changed"
        PASSWORD_RESET = "PASSWORD_RESET", "Password reset"
        SUBSCRIPTION_CHANGED = "SUBSCRIPTION_CHANGED", "Subscription changed"

    shop = models.ForeignKey(
        "shops.Shop", on_delete=models.PROTECT, related_name="audit_events"
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="saas_audit_events",
        null=True,
        blank=True,
    )
    event = models.CharField(max_length=32, choices=Event.choices, db_index=True)
    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="targeted_saas_audit_events",
        null=True,
        blank=True,
    )
    detail = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["shop", "created_at"], name="saas_audit_shop_time_idx")
        ]
