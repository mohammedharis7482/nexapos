import csv
import io
from collections.abc import Iterable
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from difflib import get_close_matches
from pathlib import Path
from time import monotonic
from typing import Any

from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone

from apps.inventory.models import InventoryBalance
from apps.inventory.services import initialize_inventory

from .import_contract import (
    PRODUCT_IMPORT_COLUMNS,
    PRODUCT_IMPORT_HEADERS,
    UNIT_DISPLAY_TO_VALUE,
    UNIT_VALUE_TO_DISPLAY,
    resolve_headers,
)
from .image_fetch import ImageFetchError, fetch_product_image, screen_image_url
from .models import (
    Product,
    ProductCategory,
    ProductImport,
    ProductImportRow,
)
from .services import (
    create_category,
    create_product,
    generate_product_sku,
    update_product,
)

MAX_IMPORT_BYTES = 5 * 1024 * 1024
MAX_IMPORT_ROWS = 10_000
IMPORT_BATCH_SIZE = 250
VALIDATION_LIFETIME = timedelta(hours=24)
ERROR_REPORT_HEADERS = (
    "Row Number",
    "Product Name",
    "Column",
    "Original Value",
    "Error Code",
    "Error",
    "Suggested Fix",
)


class ProductImportError(Exception):
    def __init__(
        self,
        message: str,
        *,
        code: str = "PRODUCT_IMPORT_INVALID",
        errors: list[dict] | None = None,
    ):
        self.message = message
        self.code = code
        self.errors = errors or []
        super().__init__(message)


def csv_template() -> str:
    """The downloadable starter file: headers plus two example rows.

    Two rows, not one, because packet sizes are stated in the product's own
    unit. A single Bottle example could only ever show whole-bottle packs,
    leaving the fractional syntax a shop needs for weighed goods undemonstrated
    - and a "0.25 bottle" packet would be nonsense.
    """
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(PRODUCT_IMPORT_HEADERS)
    writer.writerow(
        (
            "Example Milk 1L",
            "Dairy",
            "Bottle",
            "",
            "",
            "Example product; replace or remove this row.",
            "5.00",
            "6.00",
            "Tax Exempt",
            "24.000",
            "5.000",
            "Active",
            "حليب المثال 1 لتر",
            "https://example.com/images/milk.jpg",
            "6@33.00",
        )
    )
    writer.writerow(
        (
            "Example Rice",
            "Grains",
            "Kg",
            "",
            "",
            "Example weighed product; replace or remove this row.",
            "9.00",
            "12.00",
            "Tax Exempt",
            "40.000",
            "5.000",
            "Active",
            "أرز المثال",
            "https://example.com/images/rice.jpg",
            "0.25@3.50;1@13.00",
        )
    )
    return output.getvalue()


def _clean(value: Any) -> str:
    return str(value or "").strip()


def _issue(
    *,
    row_number: int,
    column: str,
    value: Any,
    error_code: str,
    human_message: str,
    suggested_fix: str = "",
) -> dict[str, Any]:
    return {
        "row_number": row_number,
        "column": column,
        "value": _clean(value),
        "error_code": error_code,
        "human_message": human_message,
        "suggested_fix": suggested_fix,
    }


def _decimal_value(
    value: str,
    *,
    row_number: int,
    column: str,
    required: bool,
    max_digits: int,
    decimal_places: int,
) -> tuple[str | None, dict | None]:
    cleaned = _clean(value)
    if not cleaned:
        if required:
            return None, _issue(
                row_number=row_number,
                column=column,
                value=value,
                error_code="REQUIRED_VALUE",
                human_message=f"{column} is required.",
                suggested_fix=f"Enter a non-negative {column.lower()}.",
            )
        return None, None
    try:
        parsed = Decimal(cleaned)
    except InvalidOperation:
        return None, _issue(
            row_number=row_number,
            column=column,
            value=value,
            error_code="INVALID_DECIMAL",
            human_message=f"{column} must be a valid decimal number.",
            suggested_fix="Use digits and a decimal point only, for example 12.50.",
        )
    if not parsed.is_finite():
        return None, _issue(
            row_number=row_number,
            column=column,
            value=value,
            error_code="INVALID_DECIMAL",
            human_message=f"{column} must be a finite number.",
        )
    if parsed < 0:
        return None, _issue(
            row_number=row_number,
            column=column,
            value=value,
            error_code="NEGATIVE_VALUE",
            human_message=f"{column} cannot be negative.",
            suggested_fix="Enter zero or a positive value.",
        )
    _, digits, exponent = parsed.as_tuple()
    decimals = max(-exponent, 0)
    integers = max(len(digits) + exponent, 0)
    if decimals > decimal_places or integers + decimals > max_digits:
        return None, _issue(
            row_number=row_number,
            column=column,
            value=value,
            error_code="DECIMAL_PRECISION",
            human_message=(
                f"{column} supports up to {max_digits - decimal_places} whole "
                f"digits and {decimal_places} decimal places."
            ),
        )
    return f"{parsed:.{decimal_places}f}", None


PACKET_PAIR_SEPARATOR = ";"
PACKET_SIZE_PRICE_SEPARATOR = "@"
# Mirrors ProductPacket.size / .price exactly - Decimal(15,3) and Decimal(12,2).
PACKET_SIZE_MAX_DIGITS = 15
PACKET_SIZE_DECIMAL_PLACES = 3
PACKET_PRICE_MAX_DIGITS = 12
PACKET_PRICE_DECIMAL_PLACES = 2


def _packet_values(value: str, row_number: int) -> tuple[list[dict] | None, list[dict]]:
    """Parse "0.25@3.50;1@13.00" into packet definitions.

    Sizes are in the product's own unit, matching how packets are stored.
    A non-empty value implies multi-pricing for the row; there is no separate
    toggle column. Malformed input is a row error naming the exact pair that
    failed, never a silent skip - a dropped packet would quietly change what a
    shop can sell.
    """
    cleaned = _clean(value)
    if not cleaned:
        return None, []

    errors: list[dict] = []
    packets: list[dict] = []
    seen_sizes: set[Decimal] = set()

    for position, chunk in enumerate(cleaned.split(PACKET_PAIR_SEPARATOR), start=1):
        pair = chunk.strip()
        if not pair:
            errors.append(
                _issue(
                    row_number=row_number,
                    column="Packet Sizes",
                    value=value,
                    error_code="PACKET_EMPTY_PAIR",
                    human_message=(
                        f"Packet {position} is empty in '{cleaned}'."
                    ),
                    suggested_fix=(
                        "Remove the extra ';' or complete the pair, "
                        "for example 0.25@3.50."
                    ),
                )
            )
            continue
        if pair.count(PACKET_SIZE_PRICE_SEPARATOR) != 1:
            errors.append(
                _issue(
                    row_number=row_number,
                    column="Packet Sizes",
                    value=value,
                    error_code="PACKET_MALFORMED_PAIR",
                    human_message=(
                        f"Packet '{pair}' must be one size@price pair."
                    ),
                    suggested_fix="Use size@price, for example 0.25@3.50.",
                )
            )
            continue

        raw_size, raw_price = (part.strip() for part in pair.split(PACKET_SIZE_PRICE_SEPARATOR))
        size, size_error = _decimal_value(
            raw_size,
            row_number=row_number,
            column=f"Packet Sizes (size in '{pair}')",
            required=True,
            max_digits=PACKET_SIZE_MAX_DIGITS,
            decimal_places=PACKET_SIZE_DECIMAL_PLACES,
        )
        price, price_error = _decimal_value(
            raw_price,
            row_number=row_number,
            column=f"Packet Sizes (price in '{pair}')",
            required=True,
            max_digits=PACKET_PRICE_MAX_DIGITS,
            decimal_places=PACKET_PRICE_DECIMAL_PLACES,
        )
        if size_error:
            errors.append(size_error)
        if price_error:
            errors.append(price_error)
        if size_error or price_error:
            continue
        if Decimal(size) <= 0:
            errors.append(
                _issue(
                    row_number=row_number,
                    column="Packet Sizes",
                    value=value,
                    error_code="PACKET_SIZE_NOT_POSITIVE",
                    human_message=f"Packet '{pair}' must have a size greater than zero.",
                    suggested_fix="Use a positive size, for example 0.25@3.50.",
                )
            )
            continue
        if Decimal(size) in seen_sizes:
            errors.append(
                _issue(
                    row_number=row_number,
                    column="Packet Sizes",
                    value=value,
                    error_code="PACKET_DUPLICATE_SIZE",
                    human_message=f"Packet size {size} is defined more than once.",
                    suggested_fix="Give each packet in a row a distinct size.",
                )
            )
            continue
        seen_sizes.add(Decimal(size))
        packets.append({"size": size, "price": price, "display_order": len(packets)})

    if errors:
        return None, errors
    return packets, []


def _status_value(value: str, row_number: int) -> tuple[bool | None, dict | None]:
    cleaned = _clean(value).casefold()
    if not cleaned or cleaned == "active":
        return True, None
    if cleaned == "inactive":
        return False, None
    return None, _issue(
        row_number=row_number,
        column="Status",
        value=value,
        error_code="INVALID_STATUS",
        human_message=f"Status '{_clean(value)}' is not supported.",
        suggested_fix="Use 'Active' or 'Inactive'.",
    )


def _tax_value(value: str, row_number: int) -> tuple[str | None, dict | None]:
    cleaned = _clean(value)
    if cleaned.casefold() in {"", "tax exempt", "exempt"}:
        return "0.00", None
    return _decimal_value(
        cleaned.rstrip("%").strip(),
        row_number=row_number,
        column="Tax Rate",
        required=False,
        max_digits=5,
        decimal_places=2,
    )


def _unit_value(value: str, row_number: int) -> tuple[str | None, dict | None]:
    cleaned = _clean(value)
    lookup = {
        **{display.casefold(): internal for display, internal in UNIT_DISPLAY_TO_VALUE.items()},
        **{internal.casefold(): internal for internal in UNIT_DISPLAY_TO_VALUE.values()},
    }
    internal = lookup.get(cleaned.casefold())
    if internal:
        return internal, None
    closest = get_close_matches(
        cleaned,
        list(UNIT_DISPLAY_TO_VALUE),
        n=1,
        cutoff=0.8,
    )
    suggestion = (
        f"Use '{closest[0]}'."
        if closest
        else f"Use one of: {', '.join(UNIT_DISPLAY_TO_VALUE)}."
    )
    return None, _issue(
        row_number=row_number,
        column="Unit",
        value=value,
        error_code="INVALID_UNIT",
        human_message=f"Unit '{cleaned}' is not supported.",
        suggested_fix=suggestion,
    )


def _chunks(rows: list[ProductImportRow]) -> Iterable[list[ProductImportRow]]:
    for start in range(0, len(rows), IMPORT_BATCH_SIZE):
        yield rows[start : start + IMPORT_BATCH_SIZE]


def _safe_filename(filename: str) -> str:
    return Path(filename).name[:255] or "products.csv"


def _decode_csv(content: bytes) -> str:
    if not content:
        raise ProductImportError("Select a non-empty CSV file.", code="EMPTY_FILE")
    if len(content) > MAX_IMPORT_BYTES:
        raise ProductImportError(
            "CSV files must be 5 MB or smaller.",
            code="FILE_TOO_LARGE",
        )
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ProductImportError(
            "CSV files must use UTF-8 encoding.",
            code="INVALID_ENCODING",
        ) from exc
    if "\x00" in text or any(
        ord(character) < 32 and character not in "\r\n\t"
        for character in text
    ):
        raise ProductImportError(
            "The selected file is not a supported text CSV.",
            code="INVALID_CSV_CONTENT",
        )
    return text


@transaction.atomic
def validate_product_import(
    *,
    shop,
    created_by,
    filename: str,
    content: bytes,
) -> ProductImport:
    started = monotonic()
    text = _decode_csv(content)
    reader = csv.reader(io.StringIO(text, newline=""), strict=True)
    try:
        supplied_headers = next(reader)
    except StopIteration as exc:
        raise ProductImportError(
            "The CSV header row is missing.",
            code="MISSING_HEADER_ROW",
        ) from exc
    except csv.Error as exc:
        raise ProductImportError(
            "The CSV header row is malformed.",
            code="MALFORMED_CSV",
        ) from exc

    header_map, header_errors = resolve_headers(supplied_headers)
    if header_errors:
        raise ProductImportError(
            "The CSV headers do not match the NexaPOS product template.",
            code="INVALID_HEADERS",
            errors=header_errors,
        )

    try:
        parsed_rows = [
            (line_number, values)
            for line_number, values in enumerate(reader, start=2)
            if any(_clean(value) for value in values)
        ]
    except csv.Error as exc:
        raise ProductImportError(
            f"The CSV is malformed near row {reader.line_num}.",
            code="MALFORMED_CSV",
            errors=[
                _issue(
                    row_number=reader.line_num,
                    column="Row",
                    value="",
                    error_code="MALFORMED_ROW",
                    human_message="The CSV row has invalid quoting or delimiters.",
                    suggested_fix="Correct the row or download a fresh template.",
                )
            ],
        ) from exc
    if not parsed_rows:
        raise ProductImportError(
            "The CSV does not contain any product rows.",
            code="EMPTY_FILE",
        )
    if len(parsed_rows) > MAX_IMPORT_ROWS:
        raise ProductImportError(
            f"A single import supports at most {MAX_IMPORT_ROWS:,} product rows.",
            code="TOO_MANY_ROWS",
        )

    existing_products = list(
        Product.objects.filter(shop=shop).only("id", "sku", "barcode")
    )
    products_by_sku = {product.sku.casefold(): product for product in existing_products}
    products_by_barcode = {
        product.barcode: product
        for product in existing_products
        if product.barcode is not None
    }
    existing_categories = {
        category.name.casefold(): category
        for category in ProductCategory.objects.filter(shop=shop).only("id", "name")
    }
    seen_skus: set[str] = set()
    seen_barcodes: set[str] = set()
    reserved_skus = set(products_by_sku)
    import_record = ProductImport.objects.create(
        shop=shop,
        created_by=created_by,
        filename=_safe_filename(filename),
        expires_at=timezone.now() + VALIDATION_LIFETIME,
    )
    rows: list[ProductImportRow] = []
    duplicate_rows = 0
    error_rows = 0
    warning_rows = 0
    categories_to_create: dict[str, str] = {}
    expected_count = len(supplied_headers)
    source_index = {header: index for index, header in enumerate(supplied_headers)}

    for row_number, values in parsed_rows:
        raw = {
            column.header: (
                values[source_index[received]]
                if source_index[received] < len(values)
                else ""
            )
            for column in PRODUCT_IMPORT_COLUMNS
            for field, received in header_map.items()
            if field == column.field
        }
        errors: list[dict] = []
        warnings: list[dict] = []
        normalized: dict[str, Any] = {}
        if len(values) != expected_count:
            errors.append(
                _issue(
                    row_number=row_number,
                    column="Row",
                    value="",
                    error_code="INCONSISTENT_COLUMN_COUNT",
                    human_message=(
                        f"Row {row_number} has {len(values)} values; "
                        f"{expected_count} are required."
                    ),
                    suggested_fix="Check commas and quoted descriptions in this row.",
                )
            )

        name = _clean(raw["Product Name"])
        if not name:
            errors.append(
                _issue(
                    row_number=row_number,
                    column="Product Name",
                    value=name,
                    error_code="REQUIRED_VALUE",
                    human_message="Product Name is required.",
                    suggested_fix="Enter the product's display name.",
                )
            )
        elif len(name) > 200:
            errors.append(
                _issue(
                    row_number=row_number,
                    column="Product Name",
                    value=name,
                    error_code="VALUE_TOO_LONG",
                    human_message="Product Name cannot exceed 200 characters.",
                )
            )
        normalized["name"] = name
        normalized["description"] = _clean(raw["Description"])

        # The optional columns use raw.get(): `raw` only carries headers the
        # file actually supplied, so a CSV predating these columns has no key
        # here at all.
        has_secondary_column = "Secondary Name" in raw
        secondary_name = _clean(raw.get("Secondary Name", ""))
        if len(secondary_name) > 200:
            errors.append(
                _issue(
                    row_number=row_number,
                    column="Secondary Name",
                    value=secondary_name,
                    error_code="VALUE_TOO_LONG",
                    human_message="Secondary Name cannot exceed 200 characters.",
                )
            )
        # None means "column absent - leave whatever the product already has".
        normalized["secondary_name"] = secondary_name if has_secondary_column else None

        if "Packet Sizes" in raw:
            packets, packet_errors = _packet_values(raw["Packet Sizes"], row_number)
            errors.extend(packet_errors)
            normalized["packets"] = packets or []
            # A non-empty Packet Sizes value is the toggle; there is no
            # separate column. An unparseable value already errored above, so
            # it never silently downgrades the product to STANDARD.
            normalized["pricing_mode"] = (
                Product.PricingMode.MULTI if packets else Product.PricingMode.STANDARD
            )
        else:
            normalized["packets"] = None
            normalized["pricing_mode"] = None

        # Only deterministic vetting here - scheme, DNS, and private-address
        # screening. No bytes are transferred at validation time; the download
        # happens after confirmation, once a product exists to attach it to.
        # A rejected URL is a warning so the rest of the row still imports.
        image_url = _clean(raw.get("Image URL", ""))
        normalized["image_url"] = ""
        if image_url:
            try:
                screen_image_url(image_url)
                normalized["image_url"] = image_url
            except ImageFetchError as exc:
                warnings.append(
                    _issue(
                        row_number=row_number,
                        column="Image URL",
                        value=image_url,
                        error_code=exc.code,
                        human_message=exc.message,
                        suggested_fix=(
                            "The product will import without an image. "
                            "Use a public https image link, or upload the "
                            "image from the product form."
                        ),
                    )
                )

        category = _clean(raw["Category"])
        if len(category) > 120:
            errors.append(
                _issue(
                    row_number=row_number,
                    column="Category",
                    value=category,
                    error_code="VALUE_TOO_LONG",
                    human_message="Category cannot exceed 120 characters.",
                )
            )
        normalized["category"] = category
        if category:
            if category.casefold() in existing_categories:
                normalized["category_state"] = "EXISTING"
            else:
                normalized["category_state"] = "NEW"
                categories_to_create.setdefault(category.casefold(), category)
        else:
            normalized["category_state"] = "NONE"

        sku = _clean(raw["SKU"]).upper()
        if not sku:
            sku = generate_product_sku(shop=shop, reserved=reserved_skus | seen_skus)
        elif len(sku) > 80:
            errors.append(
                _issue(
                    row_number=row_number,
                    column="SKU",
                    value=sku,
                    error_code="VALUE_TOO_LONG",
                    human_message="SKU cannot exceed 80 characters.",
                )
            )
        normalized["sku"] = sku

        barcode = _clean(raw["Barcode"]) or None
        if barcode and len(barcode) > 80:
            errors.append(
                _issue(
                    row_number=row_number,
                    column="Barcode",
                    value=barcode,
                    error_code="VALUE_TOO_LONG",
                    human_message="Barcode cannot exceed 80 characters.",
                )
            )
        if barcode and ("e+" in barcode.casefold() or "e-" in barcode.casefold()):
            errors.append(
                _issue(
                    row_number=row_number,
                    column="Barcode",
                    value=barcode,
                    error_code="SCIENTIFIC_NOTATION_BARCODE",
                    human_message="Barcode must be stored as its exact digits, not scientific notation.",
                    suggested_fix="Format the spreadsheet column as Text and export again.",
                )
            )
        normalized["barcode"] = barcode

        unit, unit_error = _unit_value(raw["Unit"], row_number)
        if unit_error:
            errors.append(unit_error)
        normalized["unit"] = unit
        normalized["unit_display"] = UNIT_VALUE_TO_DISPLAY.get(unit or "", "")

        for column, key, required, digits, places in (
            ("Purchase Price (QAR)", "purchase_price", False, 12, 2),
            ("Selling Price (QAR)", "selling_price", True, 12, 2),
            ("Opening Quantity", "opening_stock", False, 15, 3),
            ("Low Stock Threshold", "low_stock_alert", False, 15, 3),
        ):
            parsed, decimal_error = _decimal_value(
                raw[column],
                row_number=row_number,
                column=column,
                required=required,
                max_digits=digits,
                decimal_places=places,
            )
            if decimal_error:
                errors.append(decimal_error)
            normalized[key] = parsed
        normalized["purchase_price"] = normalized["purchase_price"] or "0.00"
        normalized["low_stock_alert"] = normalized["low_stock_alert"] or "0.000"
        if (
            normalized["opening_stock"] is None
            and Decimal(normalized["low_stock_alert"]) > 0
        ):
            errors.append(
                _issue(
                    row_number=row_number,
                    column="Low Stock Threshold",
                    value=raw["Low Stock Threshold"],
                    error_code="STOCK_REQUIRED",
                    human_message="Low Stock Threshold requires an Opening Quantity.",
                    suggested_fix="Enter Opening Quantity or clear the threshold.",
                )
            )

        tax_rate, tax_error = _tax_value(raw["Tax Rate"], row_number)
        if tax_error:
            errors.append(tax_error)
        elif tax_rate is not None and Decimal(tax_rate) > 100:
            errors.append(
                _issue(
                    row_number=row_number,
                    column="Tax Rate",
                    value=raw["Tax Rate"],
                    error_code="TAX_RATE_RANGE",
                    human_message="Tax Rate must be between 0 and 100.",
                )
            )
        normalized["tax_rate"] = tax_rate or "0.00"

        is_active, status_error = _status_value(raw["Status"], row_number)
        if status_error:
            errors.append(status_error)
        normalized["is_active"] = is_active

        if (
            normalized["selling_price"] is not None
            and Decimal(normalized["selling_price"])
            < Decimal(normalized["purchase_price"])
        ):
            warnings.append(
                _issue(
                    row_number=row_number,
                    column="Selling Price (QAR)",
                    value=raw["Selling Price (QAR)"],
                    error_code="SELLING_BELOW_PURCHASE",
                    human_message="Selling price is below purchase price.",
                    suggested_fix="Review the prices if this is not intentional.",
                )
            )

        duplicate_fields: list[str] = []
        matched_by_sku = products_by_sku.get(sku.casefold())
        matched_by_barcode = products_by_barcode.get(barcode) if barcode else None
        matched_product = matched_by_sku or matched_by_barcode
        if matched_by_sku:
            duplicate_fields.append("sku")
        if matched_by_barcode:
            duplicate_fields.append("barcode")
        if (
            matched_by_sku
            and matched_by_barcode
            and matched_by_sku.pk != matched_by_barcode.pk
        ):
            errors.append(
                _issue(
                    row_number=row_number,
                    column="SKU / Barcode",
                    value=f"{sku} / {barcode}",
                    error_code="CONFLICTING_DUPLICATES",
                    human_message="SKU and barcode match two different existing products.",
                    suggested_fix="Correct the SKU or barcode before importing.",
                )
            )
            matched_product = None
        elif duplicate_fields:
            warnings.append(
                _issue(
                    row_number=row_number,
                    column="SKU / Barcode",
                    value=f"{sku} / {barcode or ''}".strip(" /"),
                    error_code="EXISTING_PRODUCT",
                    human_message="This row matches an existing shop product.",
                    suggested_fix="Choose Skip, Update, or Cancel before confirmation.",
                )
            )

        sku_key = sku.casefold()
        if sku_key in seen_skus:
            errors.append(
                _issue(
                    row_number=row_number,
                    column="SKU",
                    value=sku,
                    error_code="DUPLICATE_SKU_IN_FILE",
                    human_message=f"SKU '{sku}' appears more than once in this CSV.",
                    suggested_fix="Use one unique SKU per row.",
                )
            )
        if barcode and barcode in seen_barcodes:
            errors.append(
                _issue(
                    row_number=row_number,
                    column="Barcode",
                    value=barcode,
                    error_code="DUPLICATE_BARCODE_IN_FILE",
                    human_message=f"Barcode '{barcode}' appears more than once in this CSV.",
                    suggested_fix="Use one unique barcode per row.",
                )
            )
        seen_skus.add(sku_key)
        reserved_skus.add(sku_key)
        if barcode:
            seen_barcodes.add(barcode)

        duplicate_rows += int(bool(duplicate_fields))
        error_rows += int(bool(errors))
        warning_rows += int(bool(warnings))
        rows.append(
            ProductImportRow(
                product_import=import_record,
                row_number=row_number,
                raw_data=raw,
                normalized_data=normalized,
                errors=errors,
                warnings=warnings,
                duplicate_fields=duplicate_fields,
                matched_product=matched_product,
            )
        )

    ProductImportRow.objects.bulk_create(rows, batch_size=IMPORT_BATCH_SIZE)
    import_record.total_rows = len(rows)
    import_record.error_rows = error_rows
    import_record.valid_rows = len(rows) - error_rows
    import_record.warning_rows = warning_rows
    import_record.duplicate_rows = duplicate_rows
    import_record.categories_to_create = sorted(
        categories_to_create.values(),
        key=str.casefold,
    )
    import_record.duration_ms = round((monotonic() - started) * 1000)
    import_record.save(
        update_fields=[
            "total_rows",
            "error_rows",
            "valid_rows",
            "warning_rows",
            "duplicate_rows",
            "categories_to_create",
            "duration_ms",
            "updated_at",
        ]
    )
    return import_record


def _product_values(data: dict[str, Any], category: ProductCategory | None) -> dict:
    values: dict[str, Any] = {
        "name": data["name"],
        "description": data["description"],
        "category": category,
        "sku": data["sku"],
        "barcode": data["barcode"],
        "unit": data["unit"],
        "purchase_price": Decimal(data["purchase_price"]),
        "selling_price": Decimal(data["selling_price"]),
        "tax_rate": Decimal(data["tax_rate"]),
        "is_active": data["is_active"],
    }
    # Absent optional columns are omitted rather than sent as blanks, so a
    # re-import through an older template never wipes a product's second name
    # or packet offer.
    if data.get("secondary_name") is not None:
        values["secondary_name"] = data["secondary_name"]
    if data.get("pricing_mode") is not None:
        values["pricing_mode"] = data["pricing_mode"]
        # create_product/update_product hand this to _sync_packets, so packets
        # are created in the same transaction as the product.
        values["packets"] = data.get("packets") or []
    return values


def confirm_product_import(
    *,
    product_import: ProductImport,
    duplicate_strategy: str,
    requested_by,
) -> ProductImport:
    started = monotonic()
    try:
        with transaction.atomic():
            locked = (
                ProductImport.objects.select_for_update()
                .select_related("shop")
                .get(pk=product_import.pk, shop=requested_by.shop)
            )
            if locked.status == ProductImport.Status.COMPLETED:
                return locked
            if locked.status != ProductImport.Status.VALIDATED:
                raise ProductImportError(
                    "Only a validated import can be confirmed.",
                    code="IMPORT_NOT_CONFIRMABLE",
                )
            if locked.expires_at and locked.expires_at <= timezone.now():
                raise ProductImportError(
                    "This validation has expired. Validate the CSV again.",
                    code="VALIDATION_EXPIRED",
                )
            if locked.error_rows:
                raise ProductImportError(
                    "Resolve all validation errors before confirming this import.",
                    code="BLOCKING_VALIDATION_ERRORS",
                )

            current_products = list(
                Product.objects.select_for_update()
                .filter(shop=locked.shop)
                .only("id", "sku", "barcode")
            )
            by_sku = {product.sku.casefold(): product for product in current_products}
            by_barcode = {
                product.barcode: product
                for product in current_products
                if product.barcode is not None
            }
            rows = list(locked.rows.order_by("row_number"))
            matched: dict[Any, Product | None] = {}
            current_duplicate_rows = 0
            for row in rows:
                data = row.normalized_data
                sku_match = by_sku.get(data["sku"].casefold())
                barcode_match = (
                    by_barcode.get(data["barcode"]) if data["barcode"] else None
                )
                if (
                    sku_match
                    and barcode_match
                    and sku_match.pk != barcode_match.pk
                ):
                    raise ProductImportError(
                        "Catalogue duplicates changed after validation. Validate the CSV again.",
                        code="DUPLICATES_CHANGED",
                    )
                matched[row.pk] = sku_match or barcode_match
                current_duplicate_rows += int(bool(matched[row.pk]))
            if (
                duplicate_strategy == ProductImport.DuplicateStrategy.CANCEL
                and current_duplicate_rows
            ):
                raise ProductImportError(
                    "Import cancelled because duplicate products were found.",
                    code="DUPLICATES_FOUND",
                )

            locked.status = ProductImport.Status.PROCESSING
            locked.duplicate_strategy = duplicate_strategy
            locked.started_at = timezone.now()
            locked.error_message = ""
            locked.failure_code = ""
            locked.save(
                update_fields=[
                    "status",
                    "duplicate_strategy",
                    "started_at",
                    "error_message",
                    "failure_code",
                    "updated_at",
                ]
            )

            categories = {
                category.name.casefold(): category
                for category in ProductCategory.objects.filter(shop=locked.shop)
            }
            counters = {
                "products_created": 0,
                "products_updated": 0,
                "products_skipped": 0,
                "categories_created": 0,
                "inventory_initialized": 0,
                "opening_movements_created": 0,
            }
            # Rows whose Image URL survived validation screening, paired with
            # the product they produced. Downloading happens after commit.
            image_targets: list[tuple[ProductImportRow, Product]] = []
            for batch in _chunks(rows):
                for row in batch:
                    data = row.normalized_data
                    product = matched[row.pk]
                    if (
                        product
                        and duplicate_strategy
                        == ProductImport.DuplicateStrategy.SKIP
                    ):
                        counters["products_skipped"] += 1
                        continue

                    category = None
                    category_name = data["category"]
                    if category_name:
                        category = categories.get(category_name.casefold())
                        if category is None:
                            category = create_category(
                                shop=locked.shop,
                                validated_data={"name": category_name},
                            )
                            categories[category_name.casefold()] = category
                            counters["categories_created"] += 1

                    values = _product_values(data, category)
                    if product:
                        product = update_product(product=product, validated_data=values)
                        counters["products_updated"] += 1
                    else:
                        product = create_product(
                            shop=locked.shop,
                            validated_data=values,
                        )
                        counters["products_created"] += 1
                        by_sku[product.sku.casefold()] = product
                        if product.barcode:
                            by_barcode[product.barcode] = product

                    if data.get("image_url"):
                        image_targets.append((row, product))

                    opening_stock = data["opening_stock"]
                    if (
                        opening_stock is not None
                        and not InventoryBalance.objects.filter(product=product).exists()
                    ):
                        initialize_inventory(
                            product=product,
                            created_by=requested_by,
                            quantity=Decimal(opening_stock),
                            low_stock_threshold=Decimal(data["low_stock_alert"]),
                            reason=f"Product import {locked.id}",
                        )
                        counters["inventory_initialized"] += 1
                        counters["opening_movements_created"] += 1

            for field, value in counters.items():
                setattr(locked, field, value)
            locked.status = ProductImport.Status.COMPLETED
            locked.completed_at = timezone.now()
            locked.duration_ms = round((monotonic() - started) * 1000)
            locked.save(
                update_fields=[
                    *counters,
                    "status",
                    "completed_at",
                    "duration_ms",
                    "updated_at",
                ]
            )
    except ProductImportError:
        raise
    except Exception as exc:
        ProductImport.objects.filter(pk=product_import.pk).update(
            status=ProductImport.Status.FAILED,
            error_message="The import failed and no catalogue changes were saved.",
            failure_code="IMPORT_TRANSACTION_FAILED",
            completed_at=timezone.now(),
            duration_ms=round((monotonic() - started) * 1000),
        )
        raise ProductImportError(
            "The import failed and all catalogue changes were rolled back.",
            code="IMPORT_TRANSACTION_FAILED",
        ) from exc

    _attach_imported_images(image_targets)
    return locked


def _attach_imported_images(targets: list[tuple[ProductImportRow, "Product"]]) -> None:
    """Download linked images after the catalogue transaction has committed.

    Deliberately outside the transaction. Network I/O inside it would hold row
    locks for the length of every download, and a slow host could stall an
    import that has already succeeded. Running after commit also gives the
    behaviour the contract asks for: a failed image never rolls back a product
    that imported fine.

    Every failure is recorded on the row's warnings so it stays visible in the
    import detail, and never raises.
    """
    if not targets:
        return
    from .services import set_product_image

    for row, product in targets:
        url = row.normalized_data.get("image_url", "")
        try:
            fetched = fetch_product_image(url)
            set_product_image(
                product=product,
                image=ContentFile(fetched.content, name=fetched.filename),
                extension=fetched.extension,
            )
        except ImageFetchError as exc:
            _record_image_warning(row, url, code=exc.code, message=exc.message)
        except Exception:  # noqa: BLE001 - an image must never fail an import
            _record_image_warning(
                row,
                url,
                code="IMAGE_ATTACH_FAILED",
                message="The image could not be saved.",
            )

    # Recount once rather than nudging the counter per row, so the summary
    # stays consistent with the rows actually carrying warnings.
    import_id = targets[0][0].product_import_id
    ProductImport.objects.filter(pk=import_id).update(
        warning_rows=ProductImportRow.objects.filter(
            product_import_id=import_id
        ).exclude(warnings=[]).count()
    )


def _record_image_warning(
    row: ProductImportRow, url: str, *, code: str, message: str
) -> None:
    row.warnings = [
        *row.warnings,
        _issue(
            row_number=row.row_number,
            column="Image URL",
            value=url,
            error_code=code,
            human_message=message,
            suggested_fix=(
                "The product imported without an image. Upload one from the "
                "product form, or fix the link and re-import."
            ),
        ),
    ]
    row.save(update_fields=["warnings", "updated_at"])


def _csv_safe(value: Any) -> str:
    text = str(value or "")
    if text.startswith(("=", "+", "-", "@", "\t", "\r")):
        return f"'{text}"
    return text


def error_report_csv(product_import: ProductImport) -> str:
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(ERROR_REPORT_HEADERS)
    for row in product_import.rows.order_by("row_number"):
        for error in row.errors:
            writer.writerow(
                [
                    row.row_number,
                    _csv_safe(row.normalized_data.get("name", "")),
                    _csv_safe(error.get("column", "")),
                    _csv_safe(error.get("value", "")),
                    _csv_safe(error.get("error_code", "")),
                    _csv_safe(error.get("human_message", "")),
                    _csv_safe(error.get("suggested_fix", "")),
                ]
            )
    return output.getvalue()
