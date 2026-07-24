from decimal import Decimal

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.products.models import Product

from .exceptions import InventoryOperationError
from .models import InventoryBalance, StockMovement

INCREASE_TYPES = {
    StockMovement.Type.STOCK_IN,
    StockMovement.Type.CORRECTION_IN,
}
DECREASE_TYPES = {
    StockMovement.Type.STOCK_OUT,
    StockMovement.Type.DAMAGE,
    StockMovement.Type.EXPIRED,
    StockMovement.Type.CORRECTION_OUT,
}
MANUAL_MOVEMENT_TYPES = INCREASE_TYPES | DECREASE_TYPES


@transaction.atomic
def initialize_inventory(
    *,
    product: Product,
    created_by: User,
    quantity: Decimal,
    low_stock_threshold: Decimal,
    reason: str = "",
) -> tuple[InventoryBalance, StockMovement]:
    locked_product = Product.objects.select_for_update().get(pk=product.pk)
    if locked_product.shop_id != created_by.shop_id:
        raise InventoryOperationError("product_id", "Product was not found.")
    if quantity < 0:
        raise InventoryOperationError("quantity", "Opening quantity cannot be negative.")
    if low_stock_threshold < 0:
        raise InventoryOperationError(
            "low_stock_threshold",
            "Low-stock threshold cannot be negative.",
        )
    if InventoryBalance.objects.filter(product=locked_product).exists():
        raise InventoryOperationError(
            "product_id",
            "Opening stock has already been configured for this product.",
        )

    try:
        balance = InventoryBalance.objects.create(
            shop=created_by.shop,
            product=locked_product,
            quantity_on_hand=quantity,
            low_stock_threshold=low_stock_threshold,
        )
    except IntegrityError as exc:
        raise InventoryOperationError(
            "product_id",
            "Opening stock has already been configured for this product.",
        ) from exc

    movement = StockMovement.objects.create(
        shop=created_by.shop,
        product=locked_product,
        inventory_balance=balance,
        movement_type=StockMovement.Type.OPENING,
        quantity_delta=quantity,
        quantity_before=Decimal("0.000"),
        quantity_after=quantity,
        reason=reason.strip(),
        created_by=created_by,
    )
    balance.last_movement_at = movement.created_at
    balance.save(update_fields=["last_movement_at", "updated_at"])
    return balance, movement


@transaction.atomic
def adjust_inventory(
    *,
    product: Product,
    created_by: User,
    movement_type: str,
    quantity: Decimal,
    reason: str = "",
    reference: str = "",
) -> tuple[InventoryBalance, StockMovement]:
    if movement_type not in MANUAL_MOVEMENT_TYPES:
        raise InventoryOperationError(
            "movement_type",
            "Select a supported manual movement type.",
        )
    if quantity <= 0:
        raise InventoryOperationError("quantity", "Quantity must be greater than zero.")

    try:
        balance = (
            InventoryBalance.objects.select_for_update()
            .select_related("product", "shop")
            .get(product=product, shop=created_by.shop)
        )
    except InventoryBalance.DoesNotExist as exc:
        raise InventoryOperationError(
            "product_id",
            "Configure opening stock before making adjustments.",
        ) from exc

    delta = quantity if movement_type in INCREASE_TYPES else -quantity
    quantity_before = balance.quantity_on_hand
    quantity_after = quantity_before + delta
    if quantity_after < 0 and not balance.allow_negative_stock:
        raise InventoryOperationError(
            "quantity",
            "Insufficient stock for this adjustment.",
        )

    movement = StockMovement.objects.create(
        shop=created_by.shop,
        product=balance.product,
        inventory_balance=balance,
        movement_type=movement_type,
        quantity_delta=delta,
        quantity_before=quantity_before,
        quantity_after=quantity_after,
        reason=reason.strip(),
        reference=reference.strip(),
        created_by=created_by,
    )
    balance.quantity_on_hand = quantity_after
    balance.last_movement_at = movement.created_at
    balance.save(
        update_fields=["quantity_on_hand", "last_movement_at", "updated_at"]
    )
    return balance, movement


@transaction.atomic
def update_low_stock_threshold(
    *,
    product: Product,
    shop_id,
    low_stock_threshold: Decimal,
) -> InventoryBalance:
    if low_stock_threshold < 0:
        raise InventoryOperationError(
            "low_stock_threshold",
            "Low-stock threshold cannot be negative.",
        )
    try:
        balance = InventoryBalance.objects.select_for_update().get(
            product=product,
            shop_id=shop_id,
        )
    except InventoryBalance.DoesNotExist as exc:
        raise InventoryOperationError(
            "product_id",
            "Configure opening stock before changing the threshold.",
        ) from exc
    balance.low_stock_threshold = low_stock_threshold
    balance.save(update_fields=["low_stock_threshold", "updated_at"])
    return balance
