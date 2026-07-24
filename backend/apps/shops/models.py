from decimal import Decimal

from django.db import models
from django.db.models import Q

from common.models import BaseModel


class Shop(BaseModel):
    name = models.CharField(max_length=150)
    legal_name = models.CharField(max_length=200, blank=True)
    address = models.TextField()
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, default="Qatar")
    phone = models.CharField(max_length=30)
    email = models.EmailField(blank=True)
    currency = models.CharField(max_length=3, default="QAR")
    timezone = models.CharField(max_length=64, default="Asia/Qatar")
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

    class Meta:
        ordering = ["name"]
        constraints = [
            models.CheckConstraint(
                condition=Q(default_tax_rate__gte=0)
                & Q(default_tax_rate__lte=100),
                name="shops_default_tax_rate_range",
            )
        ]
        indexes = [
            models.Index(fields=["name"], name="shops_name_idx"),
            models.Index(fields=["phone"], name="shops_phone_idx"),
        ]

    def __str__(self) -> str:
        return self.name
