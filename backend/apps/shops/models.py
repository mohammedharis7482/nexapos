from decimal import Decimal

from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower

from common.models import BaseModel


class Shop(BaseModel):
    class Language(models.TextChoices):
        """The supported set, defined once and shared by both language fields.

        Applies to product and category names only - app UI chrome stays
        English. Deliberately independent of `country`, which is free text and
        cannot be mapped to a language reliably.
        """

        ENGLISH = "ENGLISH", "English"
        ARABIC = "ARABIC", "Arabic"
        MALAYALAM = "MALAYALAM", "Malayalam"
        HINDI = "HINDI", "Hindi"
        URDU = "URDU", "Urdu"

    class Status(models.TextChoices):
        PENDING_VERIFICATION = "PENDING_VERIFICATION", "Pending verification"
        ONBOARDING = "ONBOARDING", "Onboarding"
        TRIAL = "TRIAL", "Trial"
        ACTIVE = "ACTIVE", "Active"
        PAST_DUE = "PAST_DUE", "Past due"
        SUSPENDED = "SUSPENDED", "Suspended"
        CANCELLED = "CANCELLED", "Cancelled"

    name = models.CharField(max_length=150)
    legal_name = models.CharField(max_length=200, blank=True)
    address = models.TextField()
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, default="Qatar")
    phone = models.CharField(max_length=30)
    email = models.EmailField(blank=True)
    currency = models.CharField(max_length=3, default="QAR")
    timezone = models.CharField(max_length=64, default="Asia/Qatar")
    primary_language = models.CharField(
        max_length=12,
        choices=Language.choices,
        default=Language.ENGLISH,
    )
    # Blank means the shop has not opted into second-language names at all,
    # in which case every surface behaves exactly as it did before.
    secondary_language = models.CharField(
        max_length=12,
        choices=Language.choices,
        blank=True,
    )
    tax_registration_number = models.CharField(max_length=50, blank=True)
    default_tax_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    invoice_prefix = models.CharField(max_length=12, default="INV")
    receipt_footer = models.TextField(blank=True)
    logo = models.ImageField(upload_to="shop-logos/", blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    status = models.CharField(
        max_length=24,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )
    primary_owner = models.OneToOneField(
        "accounts.User",
        on_delete=models.PROTECT,
        related_name="primary_shop",
        null=True,
        blank=True,
    )
    onboarding_current_step = models.PositiveSmallIntegerField(default=1)
    onboarding_completed_at = models.DateTimeField(null=True, blank=True)
    activated_at = models.DateTimeField(null=True, blank=True)
    suspended_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.CheckConstraint(
                condition=Q(default_tax_rate__gte=0)
                & Q(default_tax_rate__lte=100),
                name="shops_default_tax_rate_range",
            ),
            models.UniqueConstraint(
                Lower("email"),
                condition=~Q(email=""),
                name="shops_email_ci_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["name"], name="shops_name_idx"),
            models.Index(fields=["phone"], name="shops_phone_idx"),
            models.Index(fields=["status", "created_at"], name="shops_status_created_idx"),
        ]

    def __str__(self) -> str:
        return self.name
