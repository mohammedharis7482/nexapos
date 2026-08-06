from decimal import ROUND_HALF_UP, Decimal

MONEY_PLACES = Decimal("0.01")
QUANTITY_PLACES = Decimal("0.001")


def round_money(value: Decimal) -> Decimal:
    return value.quantize(MONEY_PLACES, rounding=ROUND_HALF_UP)


def round_quantity(value: Decimal) -> Decimal:
    return value.quantize(QUANTITY_PLACES, rounding=ROUND_HALF_UP)
