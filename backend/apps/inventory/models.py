from decimal import Decimal
from typing import Any

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import F, Q

from common.models import BaseModel


class InventoryBalance(BaseModel):
    shop = models.ForeignKey(
        "shops.Shop",
        on_delete=models.PROTECT,
        related_name="inventory_balances",
    )
    product = models.OneToOneField(
        "products.Product",
        on_delete=models.PROTECT,
        related_name="inventory_balance",
    )
    quantity_on_hand = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        default=Decimal("0.000"),
    )
    low_stock_threshold = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        default=Decimal("0.000"),
    )
    allow_negative_stock = models.BooleanField(default=False)
    last_movement_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["product__name"]
        constraints = [
            models.UniqueConstraint(
                fields=["shop", "product"],
                name="inventory_balance_shop_product_uniq",
            ),
            models.CheckConstraint(
                condition=Q(low_stock_threshold__gte=0),
                name="inventory_low_threshold_nonnegative",
            ),
            models.CheckConstraint(
                condition=Q(allow_negative_stock=True) | Q(quantity_on_hand__gte=0),
                name="inventory_quantity_negative_policy",
            ),
        ]
        indexes = [
            models.Index(
                fields=["shop", "quantity_on_hand"],
                name="inv_shop_quantity_idx",
            ),
            models.Index(
                fields=["shop", "low_stock_threshold"],
                name="inv_shop_threshold_idx",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        if self.product_id and self.shop_id and self.product.shop_id != self.shop_id:
            raise ValidationError(
                {"product": "The inventory product must belong to this shop."}
            )

    def __str__(self) -> str:
        return f"{self.product.name}: {self.quantity_on_hand}"


class StockMovement(BaseModel):
    class Type(models.TextChoices):
        OPENING = "OPENING", "Opening stock"
        STOCK_IN = "STOCK_IN", "Stock received"
        STOCK_OUT = "STOCK_OUT", "Stock removed"
        DAMAGE = "DAMAGE", "Damaged"
        EXPIRED = "EXPIRED", "Expired"
        CORRECTION_IN = "CORRECTION_IN", "Correction increase"
        CORRECTION_OUT = "CORRECTION_OUT", "Correction decrease"

    shop = models.ForeignKey(
        "shops.Shop",
        on_delete=models.PROTECT,
        related_name="stock_movements",
    )
    product = models.ForeignKey(
        "products.Product",
        on_delete=models.PROTECT,
        related_name="stock_movements",
    )
    inventory_balance = models.ForeignKey(
        InventoryBalance,
        on_delete=models.PROTECT,
        related_name="movements",
    )
    movement_type = models.CharField(max_length=20, choices=Type.choices)
    quantity_delta = models.DecimalField(max_digits=15, decimal_places=3)
    quantity_before = models.DecimalField(max_digits=15, decimal_places=3)
    quantity_after = models.DecimalField(max_digits=15, decimal_places=3)
    reason = models.CharField(max_length=500, blank=True)
    reference = models.CharField(max_length=120, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="stock_movements_created",
    )

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=~Q(quantity_delta=0) | Q(movement_type="OPENING"),
                name="inventory_movement_delta_nonzero",
            ),
            models.CheckConstraint(
                condition=Q(quantity_after=F("quantity_before") + F("quantity_delta")),
                name="inventory_movement_balances",
            ),
        ]
        indexes = [
            models.Index(
                fields=["shop", "product", "-created_at"],
                name="inv_move_shop_product_time_idx",
            ),
            models.Index(
                fields=["inventory_balance", "-created_at"],
                name="inv_move_balance_time_idx",
            ),
            models.Index(
                fields=["shop", "movement_type", "-created_at"],
                name="inv_move_shop_type_time_idx",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        related_shop_ids = {
            self.product.shop_id if self.product_id else None,
            self.inventory_balance.shop_id if self.inventory_balance_id else None,
            self.created_by.shop_id if self.created_by_id else None,
        }
        related_shop_ids.discard(None)
        if self.shop_id and any(value != self.shop_id for value in related_shop_ids):
            raise ValidationError("Movement relationships must belong to one shop.")
        if (
            self.inventory_balance_id
            and self.product_id
            and self.inventory_balance.product_id != self.product_id
        ):
            raise ValidationError(
                {"inventory_balance": "The balance must belong to this product."}
            )

    def save(self, *args: Any, **kwargs: Any) -> None:
        if self.pk and type(self).objects.filter(pk=self.pk).exists():
            raise ValidationError("Stock movements are immutable.")
        super().save(*args, **kwargs)

    def delete(self, *args: Any, **kwargs: Any):
        raise ValidationError("Stock movements cannot be deleted.")

    def __str__(self) -> str:
        return f"{self.product.name}: {self.quantity_delta}"
