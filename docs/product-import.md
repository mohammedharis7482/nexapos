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
13. `Secondary Name` (optional)
14. `Image URL` (optional)
15. `Packet Sizes` (optional)

Columns 1–12 are required. Columns 13–15 are optional, so a CSV written before
they existed still imports unchanged. Absence and blankness differ: a column the
file omits leaves the product's existing value alone, while a column present with
an empty cell clears it.

Headers are trimmed, repeated spaces are collapsed, and matching is
case-insensitive. Snake-case aliases are accepted. The legacy names `Purchase
Price`, `Selling Price`, `Opening Stock`, and `Low Stock Alert` are conservative
aliases for their corresponding columns. `Second Name`, `Image`, and `Packets`
alias the three optional columns. Missing, empty, duplicate, ambiguous, and
unsupported headers return structured errors; unrelated columns are not silently
accepted.

Example:

```csv
Product Name,Category,Unit,SKU,Barcode,Description,Purchase Price (QAR),Selling Price (QAR),Tax Rate,Opening Quantity,Low Stock Threshold,Status,Secondary Name,Image URL,Packet Sizes
Almarai Fresh Milk 1L,Dairy,Bottle,MILK-001,0628100702341,"Fresh, full-fat milk",5.00,6.00,Tax Exempt,24.000,5.000,Active,حليب المراعي ١ لتر,https://cdn.example.com/milk.jpg,
Basmati Rice,Grains,Kg,RICE-5KG,,Aged basmati,9.00,12.00,0,40.000,5.000,Active,أرز بسمتي,https://cdn.example.com/rice.jpg,0.25@3.50;1@13.00
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
- Secondary Name is optional free text, up to 200 characters, and maps to
  `Product.secondary_name`. It is stored regardless of whether the shop has set
  a secondary language; only display depends on that setting.
- Packet Sizes is semicolon-separated `size@price` pairs, for example
  `0.25@3.50;1@13.00`. Sizes are in the product's own unit and use the packet
  model's own precision - three decimals for size, two for price - checked by
  the same decimal validator as every other numeric column. Order in the cell
  becomes packet display order. A non-empty value switches the product to
  multi-pricing; there is no separate toggle column. A blank cell returns the
  product to standard pricing and removes its packet offers.
- Malformed packet syntax is a blocking row error naming the exact pair that
  failed - missing `@`, empty pair, non-numeric or negative part, a size of
  zero, or a size repeated within one row. A bad pair never imports as a plain
  standard product, because a silently dropped packet changes what the shop can
  sell.

## Image URLs

CSV cannot carry binary, so `Image URL` means the server fetches the image on
the importer's behalf. That is a server-side request forgery surface, and the
fetcher (`apps/products/image_fetch.py`) applies, in order:

1. Scheme must be `http` or `https`.
2. Every address the host resolves to is rejected if it is loopback, private,
   link-local, reserved, multicast, or unspecified - covering 127.0.0.0/8,
   10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, and the 169.254.0.0/16 cloud
   metadata range, plus IPv6 equivalents.
3. The address actually connected to is re-checked from the live socket before
   any response is read, closing DNS rebinding.
4. Redirects are followed manually, capped at three, and each hop repeats 1–3.
5. The body is size-capped at the same 5 MB ceiling as manual upload, with
   `Content-Length` used only as an early reject.
6. Format is decided by decoding the bytes, not by the URL extension or the
   response's `Content-Type`, and must be JPEG, PNG, or WEBP.

Limits come from `image_rules.py`, the same constants the manual upload endpoint
uses, so the two paths cannot drift.

Timing is split deliberately. Validation performs only the deterministic checks
- scheme, DNS, address screening - and transfers nothing, so a 10,000-row file
cannot become 10,000 outbound requests and an SSRF attempt is visible in the
preview. The download happens after the catalogue transaction commits, so
network I/O never holds row locks and a failed image never rolls back a product
that imported correctly.

Every image failure is a warning on its row, never a blocking error: the product
imports without a picture, and the warning names the reason and suggests
uploading from the product form.

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
