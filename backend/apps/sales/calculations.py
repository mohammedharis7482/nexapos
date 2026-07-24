from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP

MONEY_PLACES = Decimal("0.01")
QUANTITY_PLACES = Decimal("0.001")
ONE_HUNDRED = Decimal("100")


def round_money(value: Decimal) -> Decimal:
    return value.quantize(MONEY_PLACES, rounding=ROUND_HALF_UP)


def round_quantity(value: Decimal) -> Decimal:
    return value.quantize(QUANTITY_PLACES, rounding=ROUND_HALF_UP)


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
