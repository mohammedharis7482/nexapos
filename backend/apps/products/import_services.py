import csv
import io
import uuid
from collections.abc import Iterable
from decimal import Decimal, InvalidOperation
from typing import Any

from django.db import transaction
from django.utils import timezone

from apps.inventory.models import InventoryBalance
from apps.inventory.services import initialize_inventory

from .models import Product, ProductCategory, ProductImport, ProductImportRow
from .services import create_category, create_product, update_product

CSV_HEADERS = (
    "Product Name",
    "Category",
    "SKU",
    "Barcode",
    "Unit",
    "Purchase Price",
    "Selling Price",
    "Opening Stock",
    "Low Stock Alert",
    "Status",
)
MAX_IMPORT_BYTES = 5 * 1024 * 1024
MAX_IMPORT_ROWS = 10_000
IMPORT_BATCH_SIZE = 250


class ProductImportError(Exception):
    pass


def csv_template() -> str:
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(CSV_HEADERS)
    writer.writerow(
        (
            "Example Milk 1L",
            "Dairy",
            "",
            "",
            "BOTTLE",
            "5.00",
            "6.00",
            "24.000",
            "5.000",
            "Active",
        )
    )
    return output.getvalue()


def _clean(value: Any) -> str:
    return str(value or "").strip()


def _decimal_value(
    value: str,
    *,
    field: str,
    required: bool,
    max_digits: int,
    decimal_places: int,
) -> tuple[str | None, str | None]:
    cleaned = _clean(value)
    if not cleaned:
        if required:
            return None, f"{field} is required."
        return None, None
    try:
        parsed = Decimal(cleaned)
    except InvalidOperation:
        return None, f"{field} must be a valid number."
    if not parsed.is_finite():
        return None, f"{field} must be a finite number."
    if parsed < 0:
        return None, f"{field} cannot be negative."
    sign, digits, exponent = parsed.as_tuple()
    del sign
    decimals = max(-exponent, 0)
    integers = max(len(digits) + exponent, 0)
    if decimals > decimal_places or integers + decimals > max_digits:
        return (
            None,
            f"{field} supports up to {max_digits - decimal_places} whole digits "
            f"and {decimal_places} decimal places.",
        )
    return f"{parsed:.{decimal_places}f}", None


def _status_value(value: str) -> tuple[bool | None, str | None]:
    cleaned = _clean(value).casefold()
    if not cleaned:
        return True, None
    if cleaned in {"active", "true", "yes", "1"}:
        return True, None
    if cleaned in {"inactive", "false", "no", "0"}:
        return False, None
    return None, "Status must be Active or Inactive."


def _generated_sku(existing_skus: set[str], seen_skus: set[str]) -> str:
    while True:
        candidate = f"AUTO-{uuid.uuid4().hex[:12].upper()}"
        key = candidate.casefold()
        if key not in existing_skus and key not in seen_skus:
            return candidate


def _chunks(rows: list[ProductImportRow]) -> Iterable[list[ProductImportRow]]:
    for start in range(0, len(rows), IMPORT_BATCH_SIZE):
        yield rows[start : start + IMPORT_BATCH_SIZE]


@transaction.atomic
def validate_product_import(
    *,
    shop,
    created_by,
    filename: str,
    content: bytes,
) -> ProductImport:
    if not content:
        raise ProductImportError("Select a non-empty CSV file.")
    if len(content) > MAX_IMPORT_BYTES:
        raise ProductImportError("CSV files must be 5 MB or smaller.")
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ProductImportError("CSV files must use UTF-8 encoding.") from exc
    if "\x00" in text:
        raise ProductImportError("The CSV contains invalid null characters.")

    reader = csv.DictReader(io.StringIO(text, newline=""), strict=True)
    if reader.fieldnames is None:
        raise ProductImportError("The CSV header row is missing.")
    supplied_headers = tuple(_clean(header) for header in reader.fieldnames)
    if supplied_headers != CSV_HEADERS:
        raise ProductImportError(
            "CSV columns must exactly match the NexaPOS product template."
        )

    try:
        raw_rows = list(reader)
    except csv.Error as exc:
        raise ProductImportError(
            f"The CSV is malformed near row {reader.line_num}."
        ) from exc
    if not raw_rows:
        raise ProductImportError("The CSV does not contain any product rows.")
    if len(raw_rows) > MAX_IMPORT_ROWS:
        raise ProductImportError(
            f"A single import supports at most {MAX_IMPORT_ROWS:,} product rows."
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
    existing_skus = set(products_by_sku)
    seen_skus: set[str] = set()
    seen_barcodes: set[str] = set()
    import_record = ProductImport.objects.create(
        shop=shop,
        created_by=created_by,
        filename=filename[:255] or "products.csv",
    )
    rows: list[ProductImportRow] = []
    duplicate_rows = 0
    error_rows = 0

    for row_number, raw in enumerate(raw_rows, start=2):
        errors: dict[str, list[str]] = {}
        normalized: dict[str, Any] = {}
        if None in raw:
            errors["row"] = [
                "This row contains more values than the template defines."
            ]
        name = _clean(raw["Product Name"])
        if not name:
            errors["product_name"] = ["Product Name is required."]
        elif len(name) > 200:
            errors["product_name"] = ["Product Name cannot exceed 200 characters."]
        normalized["name"] = name

        category = _clean(raw["Category"])
        if len(category) > 120:
            errors["category"] = ["Category cannot exceed 120 characters."]
        normalized["category"] = category

        sku = _clean(raw["SKU"]).upper()
        if not sku:
            sku = _generated_sku(existing_skus, seen_skus)
        elif len(sku) > 80:
            errors["sku"] = ["SKU cannot exceed 80 characters."]
        normalized["sku"] = sku

        barcode = _clean(raw["Barcode"]) or None
        if barcode and len(barcode) > 80:
            errors["barcode"] = ["Barcode cannot exceed 80 characters."]
        normalized["barcode"] = barcode

        unit = _clean(raw["Unit"]).upper() or Product.Unit.PIECE
        if unit not in Product.Unit.values:
            errors["unit"] = [
                f"Unit must be one of: {', '.join(Product.Unit.values)}."
            ]
        normalized["unit"] = unit

        for column, key, required, digits, places in (
            ("Purchase Price", "purchase_price", False, 12, 2),
            ("Selling Price", "selling_price", True, 12, 2),
            ("Opening Stock", "opening_stock", False, 15, 3),
            ("Low Stock Alert", "low_stock_alert", False, 15, 3),
        ):
            parsed, error = _decimal_value(
                raw[column],
                field=column,
                required=required,
                max_digits=digits,
                decimal_places=places,
            )
            if error:
                errors[key] = [error]
            normalized[key] = parsed
        if normalized["purchase_price"] is None:
            normalized["purchase_price"] = "0.00"
        if normalized["low_stock_alert"] is None:
            normalized["low_stock_alert"] = "0.000"
        if (
            normalized["opening_stock"] is None
            and Decimal(normalized["low_stock_alert"]) > 0
        ):
            errors["low_stock_alert"] = [
                "Low Stock Alert requires an Opening Stock value."
            ]

        is_active, status_error = _status_value(raw["Status"])
        if status_error:
            errors["status"] = [status_error]
        normalized["is_active"] = is_active

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
            errors["duplicates"] = [
                "SKU and barcode match two different existing products."
            ]
            matched_product = None

        sku_key = sku.casefold()
        if sku_key in seen_skus:
            errors.setdefault("sku", []).append(
                "SKU is duplicated within this CSV file."
            )
        if barcode and barcode in seen_barcodes:
            errors.setdefault("barcode", []).append(
                "Barcode is duplicated within this CSV file."
            )
        seen_skus.add(sku_key)
        if barcode:
            seen_barcodes.add(barcode)

        if duplicate_fields:
            duplicate_rows += 1
        if errors:
            error_rows += 1
        rows.append(
            ProductImportRow(
                product_import=import_record,
                row_number=row_number,
                raw_data={
                    key: _clean(value)
                    for key, value in raw.items()
                    if key is not None
                },
                normalized_data=normalized,
                errors=errors,
                duplicate_fields=duplicate_fields,
                matched_product=matched_product,
            )
        )

    ProductImportRow.objects.bulk_create(rows, batch_size=IMPORT_BATCH_SIZE)
    import_record.total_rows = len(rows)
    import_record.error_rows = error_rows
    import_record.valid_rows = len(rows) - error_rows
    import_record.duplicate_rows = duplicate_rows
    import_record.save(
        update_fields=[
            "total_rows",
            "error_rows",
            "valid_rows",
            "duplicate_rows",
            "updated_at",
        ]
    )
    return import_record


def _product_values(data: dict[str, Any], category: ProductCategory | None) -> dict:
    return {
        "name": data["name"],
        "category": category,
        "sku": data["sku"],
        "barcode": data["barcode"],
        "unit": data["unit"],
        "purchase_price": Decimal(data["purchase_price"]),
        "selling_price": Decimal(data["selling_price"]),
        "is_active": data["is_active"],
    }


def confirm_product_import(
    *,
    product_import: ProductImport,
    duplicate_strategy: str,
    requested_by,
) -> ProductImport:
    try:
        with transaction.atomic():
            locked = (
                ProductImport.objects.select_for_update()
                .select_related("shop")
                .get(pk=product_import.pk, shop=requested_by.shop)
            )
            if locked.status != ProductImport.Status.VALIDATED:
                raise ProductImportError(
                    "Only a validated import can be confirmed."
                )
            if locked.error_rows:
                raise ProductImportError(
                    "Resolve all validation errors before confirming this import."
                )
            if (
                duplicate_strategy == ProductImport.DuplicateStrategy.CANCEL
                and locked.duplicate_rows
            ):
                raise ProductImportError(
                    "Import cancelled because duplicate products were found."
                )

            locked.status = ProductImport.Status.PROCESSING
            locked.duplicate_strategy = duplicate_strategy
            locked.started_at = timezone.now()
            locked.error_message = ""
            locked.save(
                update_fields=[
                    "status",
                    "duplicate_strategy",
                    "started_at",
                    "error_message",
                    "updated_at",
                ]
            )

            categories = {
                category.name.casefold(): category
                for category in ProductCategory.objects.filter(shop=locked.shop)
            }
            rows = list(
                locked.rows.select_related("matched_product").order_by("row_number")
            )
            counters = {
                "products_created": 0,
                "products_updated": 0,
                "products_skipped": 0,
                "categories_created": 0,
                "inventory_initialized": 0,
            }
            for batch in _chunks(rows):
                for row in batch:
                    data = row.normalized_data
                    product = row.matched_product
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

            for field, value in counters.items():
                setattr(locked, field, value)
            locked.status = ProductImport.Status.COMPLETED
            locked.completed_at = timezone.now()
            locked.save(
                update_fields=[
                    *counters,
                    "status",
                    "completed_at",
                    "updated_at",
                ]
            )
            return locked
    except ProductImportError:
        raise
    except Exception as exc:
        ProductImport.objects.filter(pk=product_import.pk).update(
            status=ProductImport.Status.FAILED,
            error_message="The import failed and no catalogue changes were saved.",
            completed_at=timezone.now(),
        )
        raise ProductImportError(
            "The import failed and all catalogue changes were rolled back."
        ) from exc
