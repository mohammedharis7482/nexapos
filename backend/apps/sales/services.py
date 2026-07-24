from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.inventory.models import InventoryBalance
from apps.products.models import Product

from .calculations import calculate_line_totals, round_money, round_quantity
from .exceptions import BillingOperationError
from .models import Sale, SaleItem


def _locked_accessible_draft(*, sale_id, user: User) -> Sale:
    try:
        sale = Sale.objects.select_for_update().get(pk=sale_id, shop=user.shop)
    except Sale.DoesNotExist as exc:
        raise BillingOperationError("sale_id", "Draft bill was not found.") from exc
    if user.role == User.Role.CASHIER and not user.is_superuser:
        if sale.created_by_id != user.id:
            raise BillingOperationError("sale_id", "Draft bill was not found.")
    return sale


def _require_draft(sale: Sale) -> None:
    if sale.status != Sale.Status.DRAFT:
        raise BillingOperationError(
            "status",
            "Cancelled draft bills cannot be modified.",
        )


def _available_product(
    *,
    shop_id,
    product_id=None,
    barcode: str | None = None,
) -> Product:
    queryset = Product.objects.filter(shop_id=shop_id, is_active=True)
    try:
        if product_id:
            return queryset.get(pk=product_id)
        return queryset.get(barcode=barcode)
    except Product.DoesNotExist as exc:
        field = "product_id" if product_id else "barcode"
        raise BillingOperationError(field, "An active product was not found.") from exc


def _validate_stock(*, product: Product, quantity: Decimal, shop_id) -> None:
    try:
        balance = InventoryBalance.objects.select_for_update().get(
            shop_id=shop_id,
            product=product,
        )
    except InventoryBalance.DoesNotExist as exc:
        raise BillingOperationError(
            "quantity",
            "Inventory must be initialized before adding this product.",
        ) from exc
    if not balance.allow_negative_stock and quantity > balance.quantity_on_hand:
        raise BillingOperationError(
            "quantity",
            "Requested quantity exceeds available stock.",
        )


def _apply_line_totals(item: SaleItem) -> None:
    totals = calculate_line_totals(
        quantity=item.quantity,
        unit_price=item.unit_price,
        tax_rate=item.tax_rate,
        is_tax_inclusive=item.is_tax_inclusive,
    )
    item.line_subtotal = totals.subtotal
    item.tax_amount = totals.tax
    item.line_total = totals.total


def recalculate_draft_totals(sale: Sale) -> Sale:
    items = list(sale.items.all())
    sale.subtotal = round_money(
        sum((item.line_subtotal for item in items), Decimal("0.00"))
    )
    sale.tax_total = round_money(
        sum((item.tax_amount for item in items), Decimal("0.00"))
    )
    sale.discount_total = Decimal("0.00")
    sale.grand_total = round_money(
        sum((item.line_total for item in items), Decimal("0.00"))
    )
    sale.save(
        update_fields=[
            "subtotal",
            "tax_total",
            "discount_total",
            "grand_total",
            "updated_at",
        ]
    )
    return sale


@transaction.atomic
def create_draft_sale(*, user: User, notes: str = "") -> Sale:
    return Sale.objects.create(
        shop=user.shop,
        created_by=user,
        notes=notes.strip(),
    )


@transaction.atomic
def add_product_to_draft(
    *,
    sale_id,
    user: User,
    quantity: Decimal,
    product_id=None,
    barcode: str | None = None,
) -> Sale:
    sale = _locked_accessible_draft(sale_id=sale_id, user=user)
    _require_draft(sale)
    quantity = round_quantity(quantity)
    if quantity <= 0:
        raise BillingOperationError("quantity", "Quantity must be greater than zero.")
    product = _available_product(
        shop_id=user.shop_id,
        product_id=product_id,
        barcode=barcode,
    )
    existing = SaleItem.objects.select_for_update().filter(
        sale=sale,
        product=product,
    ).first()
    requested_total = quantity + (existing.quantity if existing else Decimal("0.000"))
    _validate_stock(
        product=product,
        quantity=requested_total,
        shop_id=user.shop_id,
    )

    if existing:
        existing.quantity = requested_total
        _apply_line_totals(existing)
        existing.save(
            update_fields=[
                "quantity",
                "line_subtotal",
                "tax_amount",
                "line_total",
                "updated_at",
            ]
        )
    else:
        item = SaleItem(
            sale=sale,
            product=product,
            product_name=product.name,
            sku=product.sku,
            barcode=product.barcode,
            unit=product.unit,
            quantity=quantity,
            unit_price=product.selling_price,
            tax_rate=product.tax_rate,
            is_tax_inclusive=product.is_tax_inclusive,
            tax_amount=Decimal("0.00"),
            line_subtotal=Decimal("0.00"),
            line_total=Decimal("0.00"),
        )
        _apply_line_totals(item)
        item.save()
    return recalculate_draft_totals(sale)


@transaction.atomic
def update_draft_item_quantity(
    *,
    sale_id,
    item_id,
    user: User,
    quantity: Decimal,
) -> Sale:
    sale = _locked_accessible_draft(sale_id=sale_id, user=user)
    _require_draft(sale)
    quantity = round_quantity(quantity)
    if quantity <= 0:
        raise BillingOperationError(
            "quantity",
            "Quantity must be greater than zero; use remove for a line item.",
        )
    try:
        item = SaleItem.objects.select_for_update().select_related("product").get(
            pk=item_id,
            sale=sale,
        )
    except SaleItem.DoesNotExist as exc:
        raise BillingOperationError("item_id", "Draft item was not found.") from exc
    if not item.product.is_active:
        raise BillingOperationError("product", "Inactive products cannot be billed.")
    _validate_stock(product=item.product, quantity=quantity, shop_id=user.shop_id)
    item.quantity = quantity
    _apply_line_totals(item)
    item.save(
        update_fields=[
            "quantity",
            "line_subtotal",
            "tax_amount",
            "line_total",
            "updated_at",
        ]
    )
    return recalculate_draft_totals(sale)


@transaction.atomic
def remove_draft_item(*, sale_id, item_id, user: User) -> Sale:
    sale = _locked_accessible_draft(sale_id=sale_id, user=user)
    _require_draft(sale)
    try:
        item = SaleItem.objects.select_for_update().get(pk=item_id, sale=sale)
    except SaleItem.DoesNotExist as exc:
        raise BillingOperationError("item_id", "Draft item was not found.") from exc
    item.delete()
    return recalculate_draft_totals(sale)


@transaction.atomic
def cancel_draft_sale(*, sale_id, user: User) -> Sale:
    sale = _locked_accessible_draft(sale_id=sale_id, user=user)
    if sale.status == Sale.Status.CANCELLED:
        return sale
    sale.status = Sale.Status.CANCELLED
    sale.cancelled_at = timezone.now()
    sale.cancelled_by = user
    sale.save(
        update_fields=["status", "cancelled_at", "cancelled_by", "updated_at"]
    )
    return sale
