from decimal import Decimal
from typing import Any

from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower

from common.models import BaseModel


class ProductCategory(BaseModel):
    shop = models.ForeignKey(
        "shops.Shop",
        on_delete=models.PROTECT,
        related_name="product_categories",
    )
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    display_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["display_order", "name"]
        constraints = [
            models.UniqueConstraint(
                Lower("name"),
                "shop",
                name="products_category_shop_name_ci_uniq",
            )
        ]
        indexes = [
            models.Index(
                fields=["shop", "is_active", "display_order"],
                name="prod_cat_shop_active_order_idx",
            ),
            models.Index(fields=["shop", "name"], name="prod_cat_shop_name_idx"),
        ]

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.name = self.name.strip()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name


class Product(BaseModel):
    class Unit(models.TextChoices):
        PIECE = "PIECE", "Piece"
        KG = "KG", "Kilogram"
        GRAM = "GRAM", "Gram"
        LITRE = "LITRE", "Litre"
        MILLILITRE = "MILLILITRE", "Millilitre"
        PACK = "PACK", "Pack"
        BOX = "BOX", "Box"
        CARTON = "CARTON", "Carton"
        BOTTLE = "BOTTLE", "Bottle"
        CAN = "CAN", "Can"
        BAG = "BAG", "Bag"

    shop = models.ForeignKey(
        "shops.Shop",
        on_delete=models.PROTECT,
        related_name="products",
    )
    category = models.ForeignKey(
        ProductCategory,
        on_delete=models.PROTECT,
        related_name="products",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    sku = models.CharField(max_length=80)
    barcode = models.CharField(max_length=80, null=True, blank=True)
    unit = models.CharField(max_length=20, choices=Unit.choices, default=Unit.PIECE)
    purchase_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    selling_price = models.DecimalField(max_digits=12, decimal_places=2)
    tax_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    is_tax_inclusive = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                Lower("sku"),
                "shop",
                name="products_product_shop_sku_ci_uniq",
            ),
            models.UniqueConstraint(
                fields=["shop", "barcode"],
                condition=Q(barcode__isnull=False),
                name="products_product_shop_barcode_uniq",
            ),
            models.CheckConstraint(
                condition=Q(purchase_price__gte=0),
                name="products_purchase_price_nonnegative",
            ),
            models.CheckConstraint(
                condition=Q(selling_price__gte=0),
                name="products_selling_price_nonnegative",
            ),
            models.CheckConstraint(
                condition=Q(tax_rate__gte=0) & Q(tax_rate__lte=100),
                name="products_tax_rate_range",
            ),
        ]
        indexes = [
            models.Index(fields=["shop", "category"], name="prod_shop_category_idx"),
            models.Index(fields=["shop", "name"], name="prod_shop_name_idx"),
            models.Index(fields=["shop", "sku"], name="prod_shop_sku_idx"),
            models.Index(fields=["shop", "barcode"], name="prod_shop_barcode_idx"),
            models.Index(fields=["shop", "is_active"], name="prod_shop_active_idx"),
        ]

    def clean(self) -> None:
        super().clean()
        if self.category_id and self.shop_id:
            if self.category.shop_id != self.shop_id:
                raise ValidationError(
                    {"category": "The selected category must belong to this shop."}
                )

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.name = self.name.strip()
        self.sku = self.sku.strip().upper()
        self.barcode = self.barcode.strip() if self.barcode else None
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.name} ({self.sku})"
