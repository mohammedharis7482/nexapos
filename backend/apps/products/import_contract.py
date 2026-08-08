import re
from dataclasses import dataclass


@dataclass(frozen=True)
class ProductImportColumn:
    header: str
    field: str
    required: bool = True
    aliases: tuple[str, ...] = ()


PRODUCT_IMPORT_COLUMNS = (
    ProductImportColumn("Product Name", "product_name", aliases=("product_name",)),
    ProductImportColumn("Category", "category"),
    ProductImportColumn("Unit", "unit"),
    ProductImportColumn("SKU", "sku"),
    ProductImportColumn("Barcode", "barcode"),
    ProductImportColumn("Description", "description"),
    ProductImportColumn(
        "Purchase Price (QAR)",
        "purchase_price",
        aliases=("purchase_price", "Purchase Price"),
    ),
    ProductImportColumn(
        "Selling Price (QAR)",
        "selling_price",
        aliases=("selling_price", "Selling Price"),
    ),
    ProductImportColumn("Tax Rate", "tax_rate", aliases=("tax_rate",)),
    ProductImportColumn(
        "Opening Quantity",
        "opening_quantity",
        aliases=("opening_quantity", "Opening Stock"),
    ),
    ProductImportColumn(
        "Low Stock Threshold",
        "low_stock_threshold",
        aliases=("low_stock_threshold", "Low Stock Alert"),
    ),
    ProductImportColumn("Status", "status"),
    # The three below are the first optional columns. `required=False` means
    # resolve_headers does not demand them, so CSVs written before they
    # existed keep importing unchanged. Row parsing must read them with
    # .get(), since `raw` only carries headers the file actually supplied.
    ProductImportColumn(
        "Secondary Name",
        "secondary_name",
        required=False,
        aliases=("secondary_name", "Second Name"),
    ),
    ProductImportColumn(
        "Image URL",
        "image_url",
        required=False,
        aliases=("image_url", "Image"),
    ),
    ProductImportColumn(
        "Packet Sizes",
        "packet_sizes",
        required=False,
        aliases=("packet_sizes", "Packets"),
    ),
)
PRODUCT_IMPORT_HEADERS = tuple(column.header for column in PRODUCT_IMPORT_COLUMNS)

UNIT_DISPLAY_TO_VALUE = {
    "Bag": "BAG",
    "Bottle": "BOTTLE",
    "Box": "BOX",
    "Can": "CAN",
    "Carton": "CARTON",
    "Cup": "CUP",
    "Gram": "GRAM",
    "Jar": "JAR",
    "Kg": "KG",
    "Litre": "LITRE",
    "Millilitre": "MILLILITRE",
    "Pack": "PACK",
    "Piece": "PIECE",
    "Roll": "ROLL",
    "Tray": "TRAY",
    "Tube": "TUBE",
}
UNIT_VALUE_TO_DISPLAY = {value: key for key, value in UNIT_DISPLAY_TO_VALUE.items()}


def normalize_header(value: str) -> str:
    normalized = value.lstrip("\ufeff").strip().replace("_", " ")
    return re.sub(r"\s+", " ", normalized).casefold()


HEADER_LOOKUP = {
    normalize_header(header): column
    for column in PRODUCT_IMPORT_COLUMNS
    for header in (column.header, *column.aliases)
}


def header_error(
    *,
    error_code: str,
    column: str,
    human_message: str,
    received_header: str = "",
    expected_header: str = "",
) -> dict[str, str | int]:
    return {
        "row_number": 1,
        "error_code": error_code,
        "column": column,
        "value": received_header,
        "received_header": received_header,
        "expected_header": expected_header,
        "human_message": human_message,
        "suggested_fix": (
            "Download a fresh NexaPOS template and keep its column names unchanged."
        ),
    }


def resolve_headers(headers: list[str | None]) -> tuple[dict[str, str], list[dict]]:
    resolved: dict[str, str] = {}
    errors: list[dict] = []
    for received in headers:
        original = "" if received is None else received
        normalized = normalize_header(original)
        if not normalized:
            errors.append(
                header_error(
                    error_code="EMPTY_HEADER",
                    column="Header",
                    received_header=original,
                    human_message="CSV column names cannot be empty.",
                )
            )
            continue
        column = HEADER_LOOKUP.get(normalized)
        if column is None:
            errors.append(
                header_error(
                    error_code="UNSUPPORTED_HEADER",
                    column=original.strip() or "Header",
                    received_header=original,
                    human_message=f"The column '{original}' is not supported.",
                )
            )
            continue
        if column.field in resolved:
            errors.append(
                header_error(
                    error_code="DUPLICATE_HEADER",
                    column=column.header,
                    received_header=original,
                    expected_header=column.header,
                    human_message=f"The column '{column.header}' appears more than once.",
                )
            )
            continue
        resolved[column.field] = original

    for column in PRODUCT_IMPORT_COLUMNS:
        if column.required and column.field not in resolved:
            errors.append(
                header_error(
                    error_code="MISSING_HEADER",
                    column=column.header,
                    expected_header=column.header,
                    human_message=f"The required column '{column.header}' is missing.",
                )
            )
    return resolved, errors
