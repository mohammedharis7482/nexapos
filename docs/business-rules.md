# Business rules

1. A shop is the root boundary for business data.
2. A user belongs to exactly one shop; deleting a shop with users is protected.
3. Usernames are normalized to lowercase and unique within a shop, not globally.
4. The same normalized username may exist in different shops.
5. Every user password is set with Django password hashing. Raw passwords must
   never be stored or displayed by admin.
6. Roles are limited to `OWNER` and `CASHIER`. Superusers must be owners, active,
   and staff users.
7. New normal users require an explicit shop and default to cashier.
8. Shop defaults are QAR currency, `Asia/Qatar` timezone, and `INV` invoice
   prefix.
9. Disabled shops and users must be rejected by future business workflows.
10. Future queries and APIs must filter by the authenticated user's shop and
    must not accept an arbitrary client-provided shop as authorization.
11. Authentication uses a server-side Django session. Login rotates the session
    key, logout invalidates it, and unsafe requests require CSRF validation.
12. Inactive users and users belonging to inactive shops cannot log in.
13. Login failures do not distinguish an unknown shop, username, inactive
    account, or incorrect password.
14. Owners pass owner-only permission checks. Owners and cashiers pass shop
    staff checks. Superusers are owner-equivalent for role checks but remain
    constrained by `IsSameShop` in business APIs.
15. Object authorization derives the shop from the authenticated user and
    persisted object; client-provided shop IDs are never trusted for access.
16. There is no public registration. Initial shops and owners are created with
    the transactional `bootstrap_shop` command; subsequent controlled creation
    belongs to a later approved workflow.
17. Shop country, currency, and timezone are fixed to Qatar, QAR, and
    `Asia/Qatar`; the default tax rate is between 0 and 100.
18. Category names and product SKUs are case-insensitively unique within a shop,
    but may be reused by another shop. A non-empty barcode is unique per shop.
19. Product categories must belong to the product's shop. Prices cannot be
    negative and tax rates are restricted to 0–100. Selling below purchase
    price is allowed because promotions and clearance pricing are valid.
20. OWNER may create, edit, activate, and deactivate categories and products.
    CASHIER may only read active catalogue records.
21. Catalogue records are deactivated instead of hard-deleted. Category
    deactivation does not modify its products, and categories referenced by
    products are protected from deletion at the model level.
22. Supported units are `PIECE`, `KG`, `GRAM`, `LITRE`, `MILLILITRE`, `PACK`,
    `BOX`, `CARTON`, `BOTTLE`, `CAN`, and `BAG`.
23. Product quantity is deliberately absent. Stock is an inventory-ledger
    concern and will be introduced only in the inventory phase.

No branches, subscriptions, or SaaS billing rules are part of this foundation.
