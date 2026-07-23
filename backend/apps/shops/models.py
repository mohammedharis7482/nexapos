from django.db import models

from common.models import BaseModel


class Shop(BaseModel):
    name = models.CharField(max_length=150)
    legal_name = models.CharField(max_length=200, blank=True)
    address = models.TextField()
    phone = models.CharField(max_length=30)
    email = models.EmailField(blank=True)
    currency = models.CharField(max_length=3, default="QAR")
    timezone = models.CharField(max_length=64, default="Asia/Qatar")
    invoice_prefix = models.CharField(max_length=12, default="INV")
    receipt_footer = models.TextField(blank=True)
    logo = models.ImageField(upload_to="shop-logos/", blank=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["name"], name="shops_name_idx"),
            models.Index(fields=["phone"], name="shops_phone_idx"),
        ]

    def __str__(self) -> str:
        return self.name
