# Bulk product import

Bulk product import is an owner-only onboarding workflow for moving an existing
grocery catalogue into NexaPOS. It accepts CSV files only; Excel files,
suppliers, purchasing, and external catalogue integrations are outside this
feature.

## Workflow

1. Open **Products → Import Products**.
2. Download the NexaPOS CSV template.
3. Keep the header names and order unchanged and save the file as UTF-8 CSV.
4. Upload the file and select **Validate CSV**.
5. Review row errors, generated SKUs, and existing-product matches.
6. Correct and re-upload files with errors. Validation never changes catalogue
   or inventory data.
7. Select a duplicate strategy and confirm the import.
8. Review the completion summary, then open Products or Inventory.

Imports are limited to 5 MB and 10,000 data rows. Processing uses batches of 250
rows inside one database transaction. A fatal processing failure rolls back
products, categories, inventory balances, and stock movements created by that
confirmation attempt.

## CSV columns

| Column | Rule |
| --- | --- |
| Product Name | Required, maximum 200 characters |
| Category | Optional; a missing shop category is created on confirmation |
| SKU | Optional; blank values receive `AUTO-` plus 12 random hexadecimal characters |
| Barcode | Optional; blank values remain null |
| Unit | Existing NexaPOS unit code; defaults to `PIECE` |
| Purchase Price | Optional non-negative decimal; defaults to `0.00` |
| Selling Price | Required non-negative decimal |
| Opening Stock | Optional non-negative quantity with at most three decimal places |
| Low Stock Alert | Optional; defaults to `0.000` and requires Opening Stock when positive |
| Status | `Active` or `Inactive`; defaults to Active |

Generated SKUs are checked against the shop catalogue and other rows in the
uploaded file. Barcodes are never generated.

## Duplicate handling

SKU comparison is case-insensitive. Barcode comparison is exact after trimming.
A row is an existing duplicate when either value matches a product in the
current shop. Cross-shop products are never visible to the importer.

- **Skip** leaves the existing product and its inventory unchanged.
- **Update** updates the existing catalogue fields. If Opening Stock is supplied,
  inventory is initialized only when that product has no balance; existing stock
  is never overwritten.
- **Cancel** refuses confirmation when any existing duplicate is present.

Repeated SKUs or barcodes inside the same CSV are validation errors because
processing the same target more than once would be ambiguous. If SKU and barcode
match two different existing products, the row is also rejected.

## Inventory and billing

An empty Opening Stock value creates only the product. Supplying `0.000`
explicitly creates an initialized, out-of-stock balance and opening movement.
Positive opening stock makes an active product available to Billing under the
existing stock policy. The importer calls the same product, category, and
inventory services used by manual workflows.

## History and security

Validation creates an import history record and row preview scoped to the
authenticated user's shop. Owners can review their shop's recent imports;
cashiers receive `403` from all import endpoints. Raw files are not stored.
Preview rows contain only catalogue CSV values and validation results.

## Validation commands

```bash
cd backend
.venv/bin/python manage.py check --settings=config.settings.development
.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.settings.development
.venv/bin/python manage.py test apps.products.test_imports --settings=config.settings.development
.venv/bin/python manage.py spectacular --validate --file /tmp/nexapos-product-import-schema.yml --settings=config.settings.development

cd ../frontend
npm run lint
npm run test
npm run build
```
