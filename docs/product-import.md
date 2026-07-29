# Bulk product import

Bulk product import is an Owner/Primary Owner onboarding workflow for moving an
existing grocery catalogue into NexaPOS. It is CSV-only. Excel, suppliers,
purchasing, and external catalogue integrations remain out of scope.

## Canonical CSV contract

The template generator and validator both import the same
`PRODUCT_IMPORT_COLUMNS` definition. The official UTF-8 header order is:

1. `Product Name`
2. `Category`
3. `Unit`
4. `SKU`
5. `Barcode`
6. `Description`
7. `Purchase Price (QAR)`
8. `Selling Price (QAR)`
9. `Tax Rate`
10. `Opening Quantity`
11. `Low Stock Threshold`
12. `Status`

Headers are trimmed, repeated spaces are collapsed, and matching is
case-insensitive. Snake-case aliases are accepted. The legacy names `Purchase
Price`, `Selling Price`, `Opening Stock`, and `Low Stock Alert` are conservative
aliases for their corresponding columns. Missing, empty, duplicate, ambiguous,
and unsupported headers return structured errors; unrelated columns are not
silently accepted.

Example:

```csv
Product Name,Category,Unit,SKU,Barcode,Description,Purchase Price (QAR),Selling Price (QAR),Tax Rate,Opening Quantity,Low Stock Threshold,Status
Almarai Fresh Milk 1L,Dairy,Bottle,MILK-001,0628100702341,"Fresh, full-fat milk",5.00,6.00,Tax Exempt,24.000,5.000,Active
Tomato,Vegetables,Kg,TOMATO-KG,,Fresh tomato,2.50,3.50,0,18.500,3.000,Active
```

## Values

- Product Name and Selling Price are required.
- Category names are matched case-insensitively within the authenticated shop.
  Missing names are previewed and created only during confirmation.
- Blank SKU values use the shared server SKU generator. Generated values use
  `AUTO-` plus 12 uppercase hexadecimal characters.
- Barcode is optional and always handled as a trimmed string. Leading zeroes are
  preserved and scientific notation is rejected.
- Purchase price defaults to `0.00`; prices are non-negative two-decimal values.
- Opening Quantity and Low Stock Threshold are non-negative three-decimal
  quantities. Blank opening quantity leaves inventory uninitialized; explicit
  `0.000` initializes an out-of-stock balance.
- Tax Rate accepts `Tax Exempt`, `Exempt`, numeric `0`–`100`, and an optional
  percent sign. Tax Exempt maps to the Product model's `0.00` tax rate.
- Status accepts `Active` and `Inactive`, case-insensitively. Blank defaults to
  Active.
- Selling below purchase price produces a warning, not a blocking error.

Supported display units are Bag, Bottle, Box, Can, Carton, Cup, Gram, Jar, Kg,
Litre, Millilitre, Pack, Piece, Roll, Tray, and Tube. Internal unit codes are
also accepted case-insensitively.

## Validation and error reports

Files must be UTF-8 or UTF-8 with BOM, use the standard comma delimiter, be no
larger than 5 MB, and contain 1–10,000 non-blank data rows. Quoted commas are
supported. Binary content, malformed quoting, inconsistent row widths, and
scientific-notation barcodes are rejected.

Validation reads every row and writes only a temporary, shop-scoped validation
record and preview. It never creates Product, ProductCategory, InventoryBalance,
or StockMovement records. Any blocking row error prevents confirmation;
warnings do not.

Error reports contain row number, product name, column, original value, error
code, human-readable problem, and suggested fix. Cells beginning with spreadsheet
formula markers are prefixed safely.

## Confirmation and duplicates

Confirmation requires the validation ID, an explicit `confirmed=true`, and one
duplicate strategy:

- **Skip** leaves the existing product and inventory unchanged.
- **Update** updates catalogue fields; opening stock initializes only when the
  existing product has no InventoryBalance.
- **Cancel** refuses confirmation when any existing duplicate is found.

The backend uses persisted validated rows, verifies shop ownership and a 24-hour
expiry, and rechecks current SKU/barcode matches. Confirmation is one PostgreSQL
transaction processed in 250-row batches. A fatal failure rolls back categories,
products, balances, and movements. Repeating a completed confirmation returns
the existing summary and never creates data twice.

## History and retention

History retains safe metadata and normalized preview rows: shop, filename,
actor, timestamps, expiry, status, row/warning counts, duplicate strategy,
created/updated/skipped counts, categories, inventory/movement counts, duration,
and a safe failure code. Original CSV files are not stored.

## Validation commands

```bash
cd backend
.venv/bin/python manage.py check --settings=config.settings.development
.venv/bin/python manage.py check --deploy --settings=config.settings.production
.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.settings.development
.venv/bin/python manage.py test --settings=config.settings.development
.venv/bin/python manage.py spectacular --validate --file /tmp/nexapos-product-import-fix-schema.yml --settings=config.settings.development

cd ../frontend
npm run lint
npm run test
npm run build
```
