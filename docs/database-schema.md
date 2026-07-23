# Database schema

PostgreSQL is required. SQLite is not supported as an implicit development
fallback.

## Shared fields

`BaseModel` is abstract and supplies a Python-generated UUID primary key plus
`created_at` and `updated_at` timestamps.

## Shop

`shops.Shop` contains name, optional legal name, address, phone, optional email,
currency, timezone, invoice prefix, optional receipt footer, optional logo, and
active state. Name, phone, and active-state indexes support common administration
lookups.

## User

`accounts.User` uses `AbstractBaseUser`, `PermissionsMixin`, and `BaseModel`. It
contains a protected foreign key to Shop, full name, normalized username,
optional normalized email, owner/cashier role, active/staff flags, and join date.
A functional database constraint enforces case-insensitive uniqueness of
`(shop, username)`. Shop/role and shop/active indexes support scoped access.

Django resolves the app labels as `shops` and `accounts`; therefore the user
setting is `AUTH_USER_MODEL = "accounts.User"`.

## Migration precaution

Create the Shop migration before or together with the initial User migration.
Inspect both files before applying them. Do not migrate using Django's default
user and later swap models: `AUTH_USER_MODEL` must remain configured from the
first migration onward.
