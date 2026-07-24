from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.inventory.models import InventoryBalance, StockMovement
from apps.payments.models import Payment
from apps.products.models import Product
from apps.shops.models import Shop

from .calculations import calculate_line_totals, round_money, round_quantity
from .exceptions import BillingOperationError
from .models import Sale, SaleItem, SaleSequence


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
            "Only draft bills can be modified.",
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


def _next_sale_number(*, sale: Sale) -> str:
    Shop.objects.select_for_update().get(pk=sale.shop_id)
    sequence_date = timezone.localdate()
    sequence, _ = SaleSequence.objects.get_or_create(
        shop_id=sale.shop_id,
        sequence_date=sequence_date,
    )
    sequence.last_value += 1
    sequence.save(update_fields=["last_value", "updated_at"])
    shop_code = sale.shop_id.hex[:6].upper()
    return (
        f"NXP-{shop_code}-{sequence_date:%Y%m%d}-"
        f"{sequence.last_value:06d}"
    )


def _validate_payments(
    *,
    sale: Sale,
    payments: list[dict],
    amount_received: Decimal | None,
) -> tuple[Decimal, Decimal]:
    if not payments or len(payments) > 2:
        raise BillingOperationError(
            "payments",
            "Provide one payment, or one CASH and one CARD payment.",
        )
    methods = [payment["method"] for payment in payments]
    if len(methods) != len(set(methods)):
        raise BillingOperationError(
            "payments",
            "Each payment method may appear only once.",
        )
    for payment in payments:
        if payment["amount"] <= 0:
            raise BillingOperationError(
                "payments",
                "Payment amounts must be greater than zero.",
            )
    allocated = round_money(
        sum((payment["amount"] for payment in payments), Decimal("0.00"))
    )
    if allocated != sale.grand_total:
        raise BillingOperationError(
            "payments",
            "Allocated payments must equal the sale total.",
        )

    cash_allocated = sum(
        (
            payment["amount"]
            for payment in payments
            if payment["method"] == Payment.Method.CASH
        ),
        Decimal("0.00"),
    )
    card_allocated = allocated - cash_allocated
    if cash_allocated:
        if amount_received is None:
            raise BillingOperationError(
                "amount_received",
                "Enter the cash amount received.",
            )
        amount_received = round_money(amount_received)
        if amount_received < cash_allocated:
            raise BillingOperationError(
                "amount_received",
                "Cash received cannot be less than the allocated cash payment.",
            )
        change_due = round_money(amount_received - cash_allocated)
        total_received = round_money(amount_received + card_allocated)
    else:
        if amount_received is not None:
            raise BillingOperationError(
                "amount_received",
                "Amount received is only used for cash payments.",
            )
        total_received = allocated
        change_due = Decimal("0.00")
    return total_received, change_due


@transaction.atomic
def complete_sale(
    *,
    sale_id,
    user: User,
    payments: list[dict],
    amount_received: Decimal | None = None,
) -> Sale:
    sale = _locked_accessible_draft(sale_id=sale_id, user=user)
    _require_draft(sale)
    items = list(
        SaleItem.objects.select_for_update()
        .filter(sale=sale)
        .order_by("product_id")
    )
    if not items:
        raise BillingOperationError(
            "items",
            "Add at least one product before completing the sale.",
        )

    for item in items:
        _apply_line_totals(item)
        item.save(
            update_fields=[
                "line_subtotal",
                "tax_amount",
                "line_total",
                "updated_at",
            ]
        )
    recalculate_draft_totals(sale)

    balances = list(
        InventoryBalance.objects.select_for_update()
        .filter(
            shop_id=sale.shop_id,
            product_id__in=[item.product_id for item in items],
        )
        .order_by("product_id")
    )
    balance_by_product = {balance.product_id: balance for balance in balances}
    stock_errors: list[str] = []
    for item in items:
        balance = balance_by_product.get(item.product_id)
        if balance is None or (
            not balance.allow_negative_stock
            and item.quantity > balance.quantity_on_hand
        ):
            available = balance.quantity_on_hand if balance else Decimal("0.000")
            stock_errors.append(
                f"{item.product_name}: requested {item.quantity}, available {available}."
            )
    if stock_errors:
        raise BillingOperationError(
            "inventory",
            "Stock changed before payment. " + " ".join(stock_errors),
        )

    total_received, change_due = _validate_payments(
        sale=sale,
        payments=payments,
        amount_received=amount_received,
    )
    sale_number = _next_sale_number(sale=sale)
    completed_at = timezone.now()

    for item in items:
        balance = balance_by_product[item.product_id]
        quantity_before = balance.quantity_on_hand
        quantity_after = quantity_before - item.quantity
        movement = StockMovement.objects.create(
            shop_id=sale.shop_id,
            product_id=item.product_id,
            inventory_balance=balance,
            movement_type=StockMovement.Type.SALE,
            quantity_delta=-item.quantity,
            quantity_before=quantity_before,
            quantity_after=quantity_after,
            reason=f"Completed sale {sale_number}",
            reference=sale_number,
            created_by=user,
        )
        balance.quantity_on_hand = quantity_after
        balance.last_movement_at = movement.created_at
        balance.save(
            update_fields=["quantity_on_hand", "last_movement_at", "updated_at"]
        )

    for payment in payments:
        Payment.objects.create(
            shop_id=sale.shop_id,
            sale=sale,
            payment_method=payment["method"],
            amount=payment["amount"],
            reference=payment.get("reference", "").strip(),
            recorded_by=user,
        )

    sale.status = Sale.Status.COMPLETED
    sale.sale_number = sale_number
    sale.completed_at = completed_at
    sale.completed_by = user
    sale.amount_received = total_received
    sale.change_due = change_due
    sale.save(
        update_fields=[
            "status",
            "sale_number",
            "completed_at",
            "completed_by",
            "amount_received",
            "change_due",
            "updated_at",
        ]
    )
    return sale
