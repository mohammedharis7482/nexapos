# Database schema

The SaaS extension is described in [data-model.md](data-model.md). It adds Shop
lifecycle/onboarding/primary-owner fields, User activity fields, and Plan,
ShopSubscription, ShopInvitation, hashed account-token, and AuditEvent tables.
The data migration preserves existing operational rows, assigns the earliest
active owner as primary owner, marks existing shops onboarding-complete and
ACTIVE, and creates an ACTIVE STARTER subscription. No product, inventory,
sale, payment, or receipt table is rewritten.

PostgreSQL is required. SQLite is not supported as an implicit development
fallback.

## Shared fields

`BaseModel` is abstract and supplies a Python-generated UUID primary key plus
`created_at` and `updated_at` timestamps.

## Shop

`shops.Shop` contains name, optional legal name, address, optional city, country,
phone, optional email, currency, timezone, optional tax registration number,
default tax rate, invoice prefix, optional receipt footer, optional logo, and
active state. The tax rate has a 0–100 check constraint. Name, phone, and
active-state indexes support common administration lookups.

## User

`accounts.User` uses `AbstractBaseUser`, `PermissionsMixin`, and `BaseModel`. It
contains a protected foreign key to Shop, full name, normalized username,
optional normalized email, owner/cashier role, active/staff flags, and join date.
A functional database constraint enforces case-insensitive uniqueness of
`(shop, username)`. Shop/role and shop/active indexes support scoped access.

Django resolves the app labels as `shops` and `accounts`; therefore the user
setting is `AUTH_USER_MODEL = "accounts.User"`.

## ProductCategory

`products.ProductCategory` belongs to one protected Shop and contains a trimmed
name, optional description, display order, and active state. A functional
constraint on `Lower(name)` and shop enforces case-insensitive per-shop
uniqueness. Default ordering is display order then name.

## Product

`products.Product` belongs to one protected Shop and may reference a protected
category from that same shop. It stores a trimmed name, optional description,
normalized uppercase SKU, nullable trimmed barcode, unit, decimal purchase and
selling prices, decimal tax rate, tax-inclusive flag, and active state.
Functional/conditional constraints enforce per-shop SKU and barcode uniqueness;
check constraints prevent negative prices and tax outside 0–100. There is no
quantity, supplier, or inventory ledger field.

## ProductImport and ProductImportRow

`ProductImport` stores shop-scoped import status, source filename, selected
duplicate strategy, validation counts, completion counts, actor, and timestamps.
`ProductImportRow` stores each preview row's raw and normalized values, errors,
duplicate fields, and optional matched Product. Import row numbers are unique
within an import. Source CSV files are not persisted.

## InventoryBalance

`inventory.InventoryBalance` has an explicit Shop and one-to-one protected
Product relationship, ensuring exactly one current balance per product. Quantity
on hand and low-stock threshold use `DecimalField(max_digits=15,
decimal_places=3)`, supporting large counts and weight/volume measurements.
Thresholds cannot be negative. The database prevents a negative quantity unless
the explicit `allow_negative_stock` flag is enabled; application APIs never
enable it in this MVP. Last movement time supports operational lists.

## StockMovement

`inventory.StockMovement` is the audit ledger. It protects its Shop, Product,
InventoryBalance, and creator relationships and records type, signed delta,
before quantity, after quantity, reason, reference, creator, and timestamps.
A database constraint enforces `after = before + delta`. Deltas are nonzero
except a zero-quantity `OPENING`, which is necessary to audit valid zero opening
stock. Movement rows cannot be updated or deleted through normal APIs or admin.
Indexes support shop/product history, balance history, and movement-type review.

Same-shop relationships are validated by transactional services because
portable SQL constraints cannot compare foreign-table Shop values without a
database trigger. No triggers are used.

## Sale

`sales.Sale` is a draft-billing aggregate with protected Shop, creator, and
optional cancelling-user relationships. Its state is limited to `DRAFT` and
`CANCELLED`. Subtotal, tax, discount, and grand total are nonnegative
`DecimalField(..., decimal_places=2)` values calculated by the server. It has no
payment, receipt number, completion state, or revenue-posting fields.

## SaleItem

`sales.SaleItem` belongs to a protected Sale and Product and snapshots product
identity, unit, price, tax rate, and tax-inclusive state. Quantity uses three
decimal places; monetary values use two. A sale/product uniqueness constraint
supports quantity accumulation instead of duplicate rows. Database constraints
enforce positive quantity, nonnegative price/amounts, and a 0–100 tax rate.

Availability is checked against a locked InventoryBalance during draft
mutations, but no inventory foreign key, reservation, or stock movement is
created.

## Migration precaution

Create the Shop migration before or together with the initial User migration.
Inspect both files before applying them. Do not migrate using Django's default
user and later swap models: `AUTH_USER_MODEL` must remain configured from the
first migration onward.
# Sales completion additions

`sales.Sale` retains its draft snapshot totals and adds a nullable, globally
unique `sale_number`, completion actor/time, cash/card amount received, and
change due. Database checks keep receipt money non-negative and require the
number and completion audit fields when status is `COMPLETED`.

`sales.SaleSequence` is unique per shop and business date. Completion locks the
shop and sequence row before incrementing it, producing a shop-scoped daily
number without counting Sale rows.

`payments.Payment` belongs to one shop and completed Sale, records one positive
allocated `CASH` or `CARD` amount, an optional non-sensitive external reference,
and the recording user. Same-shop relationships are validated by the model and
completion service. Payment rows are immutable through normal application and
admin workflows.

Each completed SaleItem keeps its product identity, unit price, tax, quantity,
and line-total snapshots. Finalization updates `inventory.InventoryBalance` and
creates a distinct immutable negative `SALE` StockMovement for every line.
