# Database schema

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

## Migration precaution

Create the Shop migration before or together with the initial User migration.
Inspect both files before applying them. Do not migrate using Django's default
user and later swap models: `AUTH_USER_MODEL` must remain configured from the
first migration onward.
