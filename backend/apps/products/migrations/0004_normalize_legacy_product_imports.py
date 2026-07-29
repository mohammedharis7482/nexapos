from django.db import migrations


LEGACY_COLUMNS = {
    "product_name": "Product Name",
    "category": "Category",
    "sku": "SKU",
    "barcode": "Barcode",
    "unit": "Unit",
    "purchase_price": "Purchase Price (QAR)",
    "selling_price": "Selling Price (QAR)",
    "opening_stock": "Opening Quantity",
    "low_stock_alert": "Low Stock Threshold",
    "status": "Status",
    "duplicates": "SKU / Barcode",
    "row": "Row",
}


def normalize_legacy_imports(apps, schema_editor):
    ProductImport = apps.get_model("products", "ProductImport")
    ProductImportRow = apps.get_model("products", "ProductImportRow")

    ProductImport.objects.filter(
        status__in=("VALIDATED", "PROCESSING"),
    ).update(
        status="FAILED",
        failure_code="VALIDATION_CONTRACT_UPGRADED",
        error_message=(
            "The CSV contract was upgraded. Validate the source file again."
        ),
    )
    for row in ProductImportRow.objects.iterator(chunk_size=500):
        if not isinstance(row.errors, dict):
            continue
        structured = []
        for field, messages in row.errors.items():
            for message in messages if isinstance(messages, list) else [messages]:
                structured.append(
                    {
                        "row_number": row.row_number,
                        "column": LEGACY_COLUMNS.get(
                            field,
                            field.replace("_", " ").title(),
                        ),
                        "value": "",
                        "error_code": "LEGACY_VALIDATION_ERROR",
                        "human_message": str(message),
                        "suggested_fix": "Validate the source CSV again.",
                    }
                )
        row.errors = structured
        row.save(update_fields=["errors"])


class Migration(migrations.Migration):
    dependencies = [
        ("products", "0003_productimport_categories_to_create_and_more"),
    ]

    operations = [
        migrations.RunPython(
            normalize_legacy_imports,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
