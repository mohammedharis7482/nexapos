from typing import Any

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

from common.models import BaseModel


class Payment(BaseModel):
    class Method(models.TextChoices):
        CASH = "CASH", "Cash"
        CARD = "CARD", "Card"

    shop = models.ForeignKey(
        "shops.Shop",
        on_delete=models.PROTECT,
        related_name="payments",
    )
    sale = models.ForeignKey(
        "sales.Sale",
        on_delete=models.PROTECT,
        related_name="payments",
    )
    payment_method = models.CharField(max_length=10, choices=Method.choices)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    reference = models.CharField(max_length=120, blank=True)
    note = models.CharField(max_length=240, blank=True)
    amount_tendered = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True
    )
    change_due = models.DecimalField(
        max_digits=14, decimal_places=2, default=0
    )
    shift = models.ForeignKey(
        "sales.CashierShift", on_delete=models.PROTECT,
        related_name="payments", null=True, blank=True,
    )
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="payments_recorded",
    )

    class Meta:
        ordering = ["created_at", "id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(amount__gt=0),
                name="payments_amount_positive",
            ),
            models.CheckConstraint(
                condition=Q(amount_tendered__isnull=True) | Q(amount_tendered__gte=0),
                name="payments_tendered_nonnegative",
            ),
            models.CheckConstraint(
                condition=Q(change_due__gte=0),
                name="payments_change_nonnegative",
            ),
        ]
        indexes = [
            models.Index(
                fields=["shop", "sale"],
                name="payments_shop_sale_idx",
            ),
            models.Index(
                fields=["shop", "payment_method", "-created_at"],
                name="payments_shop_method_time_idx",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        if self.shop_id and self.sale_id and self.sale.shop_id != self.shop_id:
            raise ValidationError({"sale": "Payment and sale must share a shop."})
        if (
            self.shop_id
            and self.recorded_by_id
            and self.recorded_by.shop_id != self.shop_id
        ):
            raise ValidationError(
                {"recorded_by": "Payment recorder must belong to the sale shop."}
            )

    def save(self, *args: Any, **kwargs: Any) -> None:
        if self.pk and type(self).objects.filter(pk=self.pk).exists():
            raise ValidationError("Payment records are immutable.")
        super().save(*args, **kwargs)

    def delete(self, *args: Any, **kwargs: Any):
        raise ValidationError("Payment records cannot be deleted.")

    def __str__(self) -> str:
        return f"{self.sale_id}: {self.payment_method} {self.amount}"
