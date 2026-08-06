from dataclasses import dataclass
from decimal import Decimal

from common.money import MONEY_PLACES, QUANTITY_PLACES, round_money, round_quantity

ONE_HUNDRED = Decimal("100")

__all__ = [
    "MONEY_PLACES",
    "QUANTITY_PLACES",
    "ONE_HUNDRED",
    "round_money",
    "round_quantity",
]


@dataclass(frozen=True)
class LineTotals:
    subtotal: Decimal
    tax: Decimal
    total: Decimal


def calculate_line_totals(
    *,
    quantity: Decimal,
    unit_price: Decimal,
    tax_rate: Decimal,
    is_tax_inclusive: bool,
) -> LineTotals:
    gross = round_money(quantity * unit_price)
    if tax_rate == 0:
        return LineTotals(subtotal=gross, tax=Decimal("0.00"), total=gross)

    rate = tax_rate / ONE_HUNDRED
    if is_tax_inclusive:
        subtotal = round_money(gross / (Decimal("1") + rate))
        tax = round_money(gross - subtotal)
        return LineTotals(subtotal=subtotal, tax=tax, total=gross)

    tax = round_money(gross * rate)
    return LineTotals(
        subtotal=gross,
        tax=tax,
        total=round_money(gross + tax),
    )


def calculate_discount(
    *,
    subtotal: Decimal,
    discount_type: str,
    discount_value: Decimal,
) -> Decimal:
    """Resolve a bill-level discount against the subtotal.

    The discount is always clamped to [0, subtotal] so a grand total can
    never go negative regardless of what value was supplied.
    """
    if discount_type == "PERCENTAGE":
        raw = subtotal * (discount_value / ONE_HUNDRED)
    elif discount_type == "FIXED":
        raw = discount_value
    else:
        return Decimal("0.00")
    return max(Decimal("0.00"), min(round_money(raw), subtotal))
