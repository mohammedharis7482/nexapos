from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

from common.models import BaseModel


class Sale(BaseModel):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    shop = models.ForeignKey(
        "shops.Shop",
        on_delete=models.PROTECT,
        related_name="sales",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="sales_created",
    )
    status = models.CharField(
        max_length=12,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    subtotal = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    tax_total = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    discount_total = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    grand_total = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    notes = models.TextField(blank=True)
    sale_number = models.CharField(max_length=40, null=True, blank=True, unique=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="sales_completed",
        null=True,
        blank=True,
    )
    amount_received = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    change_due = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="sales_cancelled",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(subtotal__gte=0),
                name="sales_subtotal_nonnegative",
            ),
            models.CheckConstraint(
                condition=Q(tax_total__gte=0),
                name="sales_tax_total_nonnegative",
            ),
            models.CheckConstraint(
                condition=Q(discount_total__gte=0),
                name="sales_discount_total_nonnegative",
            ),
            models.CheckConstraint(
                condition=Q(grand_total__gte=0),
                name="sales_grand_total_nonnegative",
            ),
            models.CheckConstraint(
                condition=Q(amount_received__gte=0),
                name="sales_amount_received_nonnegative",
            ),
            models.CheckConstraint(
                condition=Q(change_due__gte=0),
                name="sales_change_due_nonnegative",
            ),
            models.CheckConstraint(
                condition=~Q(status="COMPLETED")
                | (
                    Q(sale_number__isnull=False)
                    & Q(completed_at__isnull=False)
                    & Q(completed_by__isnull=False)
                ),
                name="sales_completed_audit_required",
            ),
        ]
        indexes = [
            models.Index(
                fields=["shop", "status", "-created_at"],
                name="sales_shop_status_time_idx",
            ),
            models.Index(
                fields=["shop", "status", "-completed_at"],
                name="sales_shop_status_done_idx",
            ),
            models.Index(
                fields=["shop", "created_by", "-created_at"],
                name="sales_shop_creator_time_idx",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        if self.shop_id and self.created_by_id and self.created_by.shop_id != self.shop_id:
            raise ValidationError(
                {"created_by": "The draft creator must belong to the sale shop."}
            )
        if (
            self.shop_id
            and self.cancelled_by_id
            and self.cancelled_by.shop_id != self.shop_id
        ):
            raise ValidationError(
                {"cancelled_by": "The cancelling user must belong to the sale shop."}
            )
        if (
            self.shop_id
            and self.completed_by_id
            and self.completed_by.shop_id != self.shop_id
        ):
            raise ValidationError(
                {"completed_by": "The completing user must belong to the sale shop."}
            )

    def __str__(self) -> str:
        return f"{self.id} ({self.status})"


class SaleItem(BaseModel):
    sale = models.ForeignKey(
        Sale,
        on_delete=models.PROTECT,
        related_name="items",
    )
    product = models.ForeignKey(
        "products.Product",
        on_delete=models.PROTECT,
        related_name="sale_items",
    )
    product_name = models.CharField(max_length=200)
    sku = models.CharField(max_length=80)
    barcode = models.CharField(max_length=80, null=True, blank=True)
    unit = models.CharField(max_length=20)
    quantity = models.DecimalField(max_digits=15, decimal_places=3)
    unit_price = models.DecimalField(max_digits=14, decimal_places=2)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2)
    is_tax_inclusive = models.BooleanField(default=False)
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2)
    line_subtotal = models.DecimalField(max_digits=14, decimal_places=2)
    line_total = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        ordering = ["created_at", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["sale", "product"],
                name="sales_item_sale_product_uniq",
            ),
            models.CheckConstraint(
                condition=Q(quantity__gt=0),
                name="sales_item_quantity_positive",
            ),
            models.CheckConstraint(
                condition=Q(unit_price__gte=0),
                name="sales_item_price_nonnegative",
            ),
            models.CheckConstraint(
                condition=Q(tax_rate__gte=0) & Q(tax_rate__lte=100),
                name="sales_item_tax_rate_range",
            ),
            models.CheckConstraint(
                condition=Q(tax_amount__gte=0)
                & Q(line_subtotal__gte=0)
                & Q(line_total__gte=0),
                name="sales_item_totals_nonnegative",
            ),
        ]
        indexes = [
            models.Index(fields=["sale", "created_at"], name="sales_item_sale_time_idx"),
            models.Index(fields=["product"], name="sales_item_product_idx"),
        ]

    def clean(self) -> None:
        super().clean()
        if self.sale_id and self.product_id:
            if self.product.shop_id != self.sale.shop_id:
                raise ValidationError(
                    {"product": "The product must belong to the sale shop."}
                )

    def __str__(self) -> str:
        return f"{self.product_name} × {self.quantity}"


class SaleSequence(BaseModel):
    shop = models.ForeignKey(
        "shops.Shop",
        on_delete=models.PROTECT,
        related_name="sale_sequences",
    )
    sequence_date = models.DateField()
    last_value = models.PositiveBigIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["shop", "sequence_date"],
                name="sales_sequence_shop_date_uniq",
            )
        ]

    def __str__(self) -> str:
        return f"{self.shop.name} {self.sequence_date}: {self.last_value}"
