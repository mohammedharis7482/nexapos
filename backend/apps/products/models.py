from decimal import Decimal
from typing import Any

from django.core.exceptions import ValidationError
from django.conf import settings
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
        CUP = "CUP", "Cup"
        JAR = "JAR", "Jar"
        ROLL = "ROLL", "Roll"
        TRAY = "TRAY", "Tray"
        TUBE = "TUBE", "Tube"

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
    # Optional. Written only through the dedicated image endpoint, which
    # enforces content type and size; the field itself stays permissive so
    # existing create/update paths are unaffected. Mirrors Shop.logo.
    image = models.ImageField(upload_to="product-images/", blank=True)

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


class ProductImport(BaseModel):
    class Status(models.TextChoices):
        VALIDATED = "VALIDATED", "Validated"
        PROCESSING = "PROCESSING", "Processing"
        COMPLETED = "COMPLETED", "Completed"
        FAILED = "FAILED", "Failed"

    class DuplicateStrategy(models.TextChoices):
        SKIP = "SKIP", "Skip"
        UPDATE = "UPDATE", "Update"
        CANCEL = "CANCEL", "Cancel"

    shop = models.ForeignKey(
        "shops.Shop",
        on_delete=models.PROTECT,
        related_name="product_imports",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="product_imports",
    )
    filename = models.CharField(max_length=255)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.VALIDATED,
    )
    duplicate_strategy = models.CharField(
        max_length=10,
        choices=DuplicateStrategy.choices,
        blank=True,
    )
    total_rows = models.PositiveIntegerField(default=0)
    valid_rows = models.PositiveIntegerField(default=0)
    error_rows = models.PositiveIntegerField(default=0)
    duplicate_rows = models.PositiveIntegerField(default=0)
    products_created = models.PositiveIntegerField(default=0)
    products_updated = models.PositiveIntegerField(default=0)
    products_skipped = models.PositiveIntegerField(default=0)
    categories_created = models.PositiveIntegerField(default=0)
    inventory_initialized = models.PositiveIntegerField(default=0)
    warning_rows = models.PositiveIntegerField(default=0)
    categories_to_create = models.JSONField(default=list)
    opening_movements_created = models.PositiveIntegerField(default=0)
    expires_at = models.DateTimeField(null=True, blank=True)
    duration_ms = models.PositiveIntegerField(null=True, blank=True)
    failure_code = models.CharField(max_length=50, blank=True)
    error_message = models.TextField(blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(
                fields=["shop", "-created_at"],
                name="prod_import_shop_time_idx",
            ),
            models.Index(
                fields=["shop", "status"],
                name="prod_import_shop_status_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.filename} ({self.get_status_display()})"


class ProductImportRow(BaseModel):
    product_import = models.ForeignKey(
        ProductImport,
        on_delete=models.CASCADE,
        related_name="rows",
    )
    row_number = models.PositiveIntegerField()
    raw_data = models.JSONField(default=dict)
    normalized_data = models.JSONField(default=dict)
    errors = models.JSONField(default=list)
    warnings = models.JSONField(default=list)
    duplicate_fields = models.JSONField(default=list)
    matched_product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        related_name="import_rows",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["row_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["product_import", "row_number"],
                name="products_import_row_number_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["product_import", "row_number"],
                name="prod_import_row_order_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.product_import.filename}: row {self.row_number}"
