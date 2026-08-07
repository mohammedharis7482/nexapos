from collections import Counter
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Count, DecimalField, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone

from apps.accounts.models import User
from apps.inventory.models import InventoryBalance, StockMovement
from apps.payments.models import Payment
from apps.products.models import Product, ProductPacket

from .calculations import (
    calculate_discount,
    calculate_line_totals,
    round_money,
    round_quantity,
)
from .exceptions import BillingOperationError
from apps.saas.models import AuditEvent
from .models import CashierShift, Sale, SaleItem, SaleSequence


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


def _audit(*, user: User, event: str, detail: str = "") -> None:
    AuditEvent.objects.create(
        shop=user.shop, actor=user, event=event, detail=detail[:200]
    )


def active_shift_for(user: User, *, lock: bool = False) -> CashierShift | None:
    queryset = CashierShift.objects.filter(
        shop=user.shop, cashier=user, status=CashierShift.Status.OPEN
    )
    if lock:
        queryset = queryset.select_for_update()
    return queryset.first()


@transaction.atomic
def open_shift(
    *, user: User, opening_cash: Decimal = Decimal("0.00"), opening_note: str = ""
) -> CashierShift:
    if not user.is_active:
        raise BillingOperationError("cashier", "Inactive users cannot open shifts.")
    opening_cash = round_money(opening_cash)
    if opening_cash < 0:
        raise BillingOperationError("opening_cash", "Opening cash cannot be negative.")
    if active_shift_for(user, lock=True):
        raise BillingOperationError("status", "This user already has an open shift.")
    try:
        shift = CashierShift.objects.create(
            shop=user.shop, cashier=user, opened_by=user,
            opening_cash=opening_cash, opening_note=opening_note.strip(),
        )
    except IntegrityError as exc:
        raise BillingOperationError("status", "This user already has an open shift.") from exc
    _audit(user=user, event=AuditEvent.Event.SHIFT_OPENED)
    return shift


def shift_summary(shift: CashierShift) -> dict:
    return bulk_shift_summaries([shift])[shift.id]


def bulk_shift_summaries(shifts) -> dict:
    """Compute shift_summary()'s fields for many shifts in a fixed number of
    queries, independent of how many shifts are passed.

    Each grouped aggregate below is scoped to exactly one joined relation
    (payments, sale items, or neither) so no aggregate ever fans out across
    two joins at once - mixing joins in a single aggregate() call would let a
    completed sale with N items get counted/summed N times instead of once.
    """
    shifts = list(shifts)
    if not shifts:
        return {}
    shift_ids = [shift.id for shift in shifts]
    money_field = DecimalField(max_digits=14, decimal_places=2)

    payment_totals: dict = {}
    for row in (
        Payment.objects.filter(shift_id__in=shift_ids, sale__status=Sale.Status.COMPLETED)
        .values("shift_id", "payment_method")
        .annotate(total=Coalesce(Sum("amount"), Decimal("0.00"), output_field=money_field))
    ):
        payment_totals.setdefault(row["shift_id"], {})[row["payment_method"]] = row["total"]

    sale_aggregates = {
        row["shift_id"]: row
        for row in (
            Sale.objects.filter(shift_id__in=shift_ids, status=Sale.Status.COMPLETED)
            .values("shift_id")
            .annotate(
                completed_bills=Count("id"),
                gross_sales=Coalesce(Sum("grand_total"), Decimal("0.00"), output_field=money_field),
            )
        )
    }

    items_sold_by_shift = {
        row["sale__shift_id"]: row["items_sold"]
        for row in (
            SaleItem.objects.filter(
                sale__shift_id__in=shift_ids, sale__status=Sale.Status.COMPLETED
            )
            .values("sale__shift_id")
            .annotate(
                items_sold=Coalesce(
                    Sum("stock_quantity"), Decimal("0.000"),
                    output_field=DecimalField(max_digits=15, decimal_places=3),
                )
            )
        )
    }

    # Deliberately not a second .values().annotate() chained onto the first
    # annotate()/filter(): re-grouping by shift_id there would rewrite the
    # HAVING clause to apply across the whole shift instead of per sale.
    # Pulling the (already correctly per-sale-filtered) shift_id values and
    # counting them in Python avoids that regrouping trap.
    split_counts = Counter(
        Sale.objects.filter(shift_id__in=shift_ids, status=Sale.Status.COMPLETED)
        .annotate(payment_count=Count("payments"))
        .filter(payment_count__gt=1)
        .values_list("shift_id", flat=True)
    )

    summaries = {}
    for shift in shifts:
        agg = sale_aggregates.get(shift.id, {})
        shift_payments = payment_totals.get(shift.id, {})
        cash = shift_payments.get(Payment.Method.CASH, Decimal("0.00"))
        card = shift_payments.get(Payment.Method.CARD, Decimal("0.00"))
        summaries[shift.id] = {
            "opening_cash": shift.opening_cash,
            "completed_bills": agg.get("completed_bills", 0),
            "gross_sales": agg.get("gross_sales", Decimal("0.00")),
            "cash_sales": cash,
            "card_sales": card,
            "split_payment_count": split_counts.get(shift.id, 0),
            "expected_closing_cash": round_money(shift.opening_cash + cash),
            "counted_closing_cash": shift.counted_closing_cash,
            "cash_difference": shift.cash_difference,
            "items_sold": items_sold_by_shift.get(shift.id, Decimal("0.000")),
            "opened_at": shift.opened_at,
            "closed_at": shift.closed_at,
        }
    return summaries


@transaction.atomic
def close_shift(
    *, shift_id, user: User, counted_closing_cash: Decimal, closing_note: str = ""
) -> CashierShift:
    try:
        shift = CashierShift.objects.select_for_update().get(
            pk=shift_id, shop=user.shop
        )
    except CashierShift.DoesNotExist as exc:
        raise BillingOperationError("shift", "Shift was not found.") from exc
    if shift.cashier_id != user.id and user.role != User.Role.OWNER:
        raise BillingOperationError("shift", "Shift was not found.")
    if shift.status != CashierShift.Status.OPEN:
        raise BillingOperationError("status", "Only an open shift can be closed.")
    counted = round_money(counted_closing_cash)
    if counted < 0:
        raise BillingOperationError(
            "counted_closing_cash", "Counted cash cannot be negative."
        )
    expected = shift_summary(shift)["expected_closing_cash"]
    shift.status = CashierShift.Status.CLOSED
    shift.closed_at = timezone.now()
    shift.expected_closing_cash = expected
    shift.counted_closing_cash = counted
    shift.cash_difference = round_money(counted - expected)
    shift.closing_note = closing_note.strip()
    shift.closed_by = user
    shift.save(update_fields=[
        "status", "closed_at", "expected_closing_cash",
        "counted_closing_cash", "cash_difference", "closing_note",
        "closed_by", "updated_at",
    ])
    _audit(user=user, event=AuditEvent.Event.SHIFT_CLOSED)
    return shift


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
    """Lock the product's single balance and check a base-unit demand against it.

    `quantity` is always a stock quantity in the product's own unit, never a
    packet count - a packet line and a loose line of the same product share
    this one balance, which is what keeps their stock from drifting apart.
    """
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


def _other_lines_stock_demand(*, sale: Sale, product: Product, exclude_item_id=None) -> Decimal:
    """Stock already claimed for this product by the draft's *other* lines.

    A multi-pricing product can hold both a packet line and a loose line, so
    availability has to be judged against their combined draw on the shared
    pool - never one line at a time.
    """
    queryset = SaleItem.objects.filter(sale=sale, product=product)
    if exclude_item_id is not None:
        queryset = queryset.exclude(pk=exclude_item_id)
    return sum(
        (item.stock_quantity for item in queryset),
        Decimal("0.000"),
    )


def _resolve_pricing(
    *,
    product: Product,
    pricing_mode: str,
    packet_id,
    quantity: Decimal,
) -> tuple[str, "ProductPacket | None", Decimal, Decimal]:
    """Map a requested pricing mode onto (mode, packet, unit_price, stock_quantity).

    Returns the stock quantity separately from the charged quantity: for a
    packet line the customer is billed per packet at the packet's exact price,
    while inventory is drawn down by quantity x packet size.
    """
    if product.pricing_mode == Product.PricingMode.STANDARD:
        if pricing_mode and pricing_mode != SaleItem.PricingMode.STANDARD:
            raise BillingOperationError(
                "pricing_mode",
                "This product is not set up for packet or loose selling.",
            )
        return (
            SaleItem.PricingMode.STANDARD,
            None,
            product.selling_price,
            quantity,
        )

    if pricing_mode == SaleItem.PricingMode.LOOSE:
        return SaleItem.PricingMode.LOOSE, None, product.selling_price, quantity

    if pricing_mode != SaleItem.PricingMode.PACKET:
        raise BillingOperationError(
            "pricing_mode",
            "Choose a packet or loose price for this product.",
        )
    if not packet_id:
        raise BillingOperationError("packet_id", "Choose a packet size.")
    packet = ProductPacket.objects.filter(
        pk=packet_id, product=product, is_active=True
    ).first()
    if packet is None:
        raise BillingOperationError("packet_id", "That packet size is unavailable.")
    if quantity != quantity.to_integral_value():
        raise BillingOperationError(
            "quantity",
            "Packets are sold in whole numbers.",
        )
    return (
        SaleItem.PricingMode.PACKET,
        packet,
        packet.price,
        round_quantity(quantity * packet.size),
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
    sale.discount_total = calculate_discount(
        subtotal=sale.subtotal,
        discount_type=sale.discount_type,
        discount_value=sale.discount_value,
    )
    lines_total = round_money(
        sum((item.line_total for item in items), Decimal("0.00"))
    )
    sale.grand_total = round_money(lines_total - sale.discount_total)
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
def set_draft_discount(
    *,
    sale_id,
    user: User,
    discount_type: str,
    discount_value: Decimal,
) -> Sale:
    sale = _locked_accessible_draft(sale_id=sale_id, user=user)
    _require_draft(sale)
    if discount_type == Sale.DiscountType.NONE:
        discount_value = Decimal("0.00")
    elif discount_type == Sale.DiscountType.PERCENTAGE and discount_value > 100:
        raise BillingOperationError(
            "discount_value", "Percentage discount cannot exceed 100%."
        )
    elif discount_type == Sale.DiscountType.FIXED and discount_value > sale.subtotal:
        raise BillingOperationError(
            "discount_value", "Discount cannot exceed the subtotal."
        )
    sale.discount_type = discount_type
    sale.discount_value = round_money(discount_value)
    sale.save(update_fields=["discount_type", "discount_value", "updated_at"])
    return recalculate_draft_totals(sale)


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
    pricing_mode: str = "",
    packet_id=None,
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
    mode, packet, unit_price, stock_quantity = _resolve_pricing(
        product=product,
        pricing_mode=pricing_mode,
        packet_id=packet_id,
        quantity=quantity,
    )
    # Merge on the full pricing identity, not just the product: two 250 g
    # packets are the same line, but a packet and a loose weight are not.
    existing = SaleItem.objects.select_for_update().filter(
        sale=sale,
        product=product,
        pricing_mode=mode,
        packet=packet,
    ).first()
    if existing:
        quantity = existing.quantity + quantity
        stock_quantity = round_quantity(stock_quantity + existing.stock_quantity)
    _validate_stock(
        product=product,
        quantity=stock_quantity
        + _other_lines_stock_demand(
            sale=sale,
            product=product,
            exclude_item_id=existing.pk if existing else None,
        ),
        shop_id=user.shop_id,
    )

    if existing:
        existing.quantity = quantity
        existing.stock_quantity = stock_quantity
        _apply_line_totals(existing)
        existing.save(
            update_fields=[
                "quantity",
                "stock_quantity",
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
            pricing_mode=mode,
            packet=packet,
            packet_size=packet.size if packet else None,
            quantity=quantity,
            stock_quantity=stock_quantity,
            unit_price=unit_price,
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
    if item.pricing_mode == SaleItem.PricingMode.PACKET:
        if quantity != quantity.to_integral_value():
            raise BillingOperationError("quantity", "Packets are sold in whole numbers.")
        # packet_size is the snapshot taken when the line was added, so editing
        # the packet definition afterwards cannot rewrite this line's stock draw.
        stock_quantity = round_quantity(quantity * item.packet_size)
    else:
        stock_quantity = quantity
    _validate_stock(
        product=item.product,
        quantity=stock_quantity
        + _other_lines_stock_demand(
            sale=sale, product=item.product, exclude_item_id=item.pk
        ),
        shop_id=user.shop_id,
    )
    item.quantity = quantity
    item.stock_quantity = stock_quantity
    _apply_line_totals(item)
    item.save(
        update_fields=[
            "quantity",
            "stock_quantity",
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
    if sale.status not in (Sale.Status.DRAFT, Sale.Status.HELD):
        _require_draft(sale)
    sale.status = Sale.Status.CANCELLED
    sale.cancelled_at = timezone.now()
    sale.cancelled_by = user
    sale.save(
        update_fields=["status", "cancelled_at", "cancelled_by", "updated_at"]
    )
    _audit(user=user, event=AuditEvent.Event.BILL_CANCELLED)
    return sale


@transaction.atomic
def hold_draft_sale(*, sale_id, user: User, note: str = "") -> Sale:
    sale = _locked_accessible_draft(sale_id=sale_id, user=user)
    _require_draft(sale)
    sale.status = Sale.Status.HELD
    sale.held_at = timezone.now()
    sale.held_by = user
    if note.strip():
        sale.notes = note.strip()
    sale.save(update_fields=["status", "held_at", "held_by", "notes", "updated_at"])
    _audit(user=user, event=AuditEvent.Event.BILL_HELD)
    return sale


@transaction.atomic
def resume_held_sale(*, sale_id, user: User) -> Sale:
    sale = _locked_accessible_draft(sale_id=sale_id, user=user)
    if sale.status != Sale.Status.HELD:
        raise BillingOperationError("status", "Only a held bill can be resumed.")
    demand_by_product: dict = {}
    for item in sale.items.select_related("product", "packet"):
        if not item.product.is_active:
            raise BillingOperationError(
                "items", f"{item.product_name} is no longer active."
            )
        current_price = (
            item.packet.price
            if item.pricing_mode == SaleItem.PricingMode.PACKET and item.packet
            else item.product.selling_price
        )
        if item.unit_price != current_price:
            raise BillingOperationError(
                "items", f"{item.product_name} has a new price; review the bill."
            )
        entry = demand_by_product.setdefault(
            item.product_id, [item.product, Decimal("0.000")]
        )
        entry[1] += item.stock_quantity
    # Checked per product, not per line: a packet line and a loose line of the
    # same product can each fit but jointly exceed the shared pool.
    for product, demand in demand_by_product.values():
        _validate_stock(product=product, quantity=demand, shop_id=user.shop_id)
    sale.status = Sale.Status.DRAFT
    sale.save(update_fields=["status", "updated_at"])
    _audit(user=user, event=AuditEvent.Event.BILL_RESUMED)
    return sale


def _next_sale_number(*, sale: Sale) -> str:
    sequence_date = timezone.localdate()
    # Ensure today's counter row exists before locking it. The first sale of
    # the day is the only racing path here, and get_or_create handles it
    # internally: it retries the read after an IntegrityError against the
    # (shop, sequence_date) unique constraint, inside its own savepoint so
    # the surrounding transaction survives.
    SaleSequence.objects.get_or_create(
        shop_id=sale.shop_id,
        sequence_date=sequence_date,
    )
    # Lock only this shop's counter for today, not the whole Shop row.
    # Locking shops_shop as the mutex serialised every checkout in a shop
    # against every other checkout, and against unrelated shop writes
    # (settings, onboarding, quota enforcement) - concurrent sales of
    # different products on different registers had no reason to contend.
    sequence = SaleSequence.objects.select_for_update().get(
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
    shift = active_shift_for(user, lock=True)
    if shift is None:
        raise BillingOperationError(
            "shift", "Open a cashier shift before completing a sale."
        )
    _require_draft(sale)
    items = list(
        SaleItem.objects.select_for_update()
        .filter(sale=sale)
        .order_by("product_id", "id")
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
    # Demand is summed per product before it is compared to the balance. One
    # product can now occupy several lines (a packet line plus a loose line),
    # and checking those individually would let a pair that each fit but
    # jointly overdraw the shared pool through to deduction.
    demand_by_product: dict = {}
    names_by_product: dict = {}
    for item in items:
        demand_by_product[item.product_id] = (
            demand_by_product.get(item.product_id, Decimal("0.000"))
            + item.stock_quantity
        )
        names_by_product[item.product_id] = item.product_name
    stock_errors: list[str] = []
    for product_id, demand in demand_by_product.items():
        balance = balance_by_product.get(product_id)
        if balance is None or (
            not balance.allow_negative_stock and demand > balance.quantity_on_hand
        ):
            available = balance.quantity_on_hand if balance else Decimal("0.000")
            stock_errors.append(
                f"{names_by_product[product_id]}: requested {demand}, "
                f"available {available}."
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
        # One movement per line keeps packet and loose sales individually
        # traceable. The running balance stays correct across two lines of the
        # same product because they share this one locked balance object.
        quantity_before = balance.quantity_on_hand
        quantity_after = quantity_before - item.stock_quantity
        movement = StockMovement.objects.create(
            shop_id=sale.shop_id,
            product_id=item.product_id,
            inventory_balance=balance,
            movement_type=StockMovement.Type.SALE,
            quantity_delta=-item.stock_quantity,
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
        is_cash = payment["method"] == Payment.Method.CASH
        Payment.objects.create(
            shop_id=sale.shop_id,
            sale=sale,
            payment_method=payment["method"],
            amount=payment["amount"],
            reference=payment.get("reference", "").strip(),
            amount_tendered=amount_received if is_cash else None,
            change_due=change_due if is_cash else Decimal("0.00"),
            note=payment.get("note", "").strip(),
            shift=shift,
            recorded_by=user,
        )
        if payment["method"] == Payment.Method.CARD:
            _audit(user=user, event=AuditEvent.Event.CARD_PAYMENT_RECORDED)

    sale.status = Sale.Status.COMPLETED
    sale.sale_number = sale_number
    sale.completed_at = completed_at
    sale.completed_by = user
    sale.shift = shift
    sale.amount_received = total_received
    sale.change_due = change_due
    sale.save(
        update_fields=[
            "status",
            "sale_number",
            "completed_at",
            "completed_by",
            "shift",
            "amount_received",
            "change_due",
            "updated_at",
        ]
    )
    _audit(user=user, event=AuditEvent.Event.SALE_COMPLETED)
    return sale
