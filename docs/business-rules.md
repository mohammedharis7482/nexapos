# Business rules

Manual catalogue entry requires a shop-scoped SKU, normalized to uppercase and
unique case-insensitively within the shop. Barcode is optional, trimmed, stored
as null when blank, and unique only among non-empty values in the same shop.
Creating a product never silently creates inventory. Opening stock is a
separate, explicit, one-time operation, so cancelling or retrying that step
does not duplicate the valid product.

Kilogram, gram, litre, and millilitre quantities use three-decimal Decimal
storage through inventory, billing, movements, and receipts. Counted units use
the existing quantity policy.

New completed sales require the completing user's open shift. Expected drawer
cash is opening cash plus completed cash allocations only. Held bills reserve
no stock and are revalidated on resume. Card success is confirmed externally.

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
13a. Existing sessions become unauthenticated when the user or shop is
     deactivated. Login attempts are application-throttled, with shared
     deployment-edge throttling additionally required.
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
    concern and is stored in `InventoryBalance`, never on Product.
24. A product may exist without inventory. Opening stock explicitly creates its
    only balance and an `OPENING` movement; zero opening stock is valid.
25. Inventory quantities use three decimal places. Manual requests always send
    positive quantities; `STOCK_IN` and `CORRECTION_IN` produce positive deltas,
    while `STOCK_OUT`, `DAMAGE`, `EXPIRED`, and `CORRECTION_OUT` produce
    negative deltas.
26. Negative stock is disabled for the MVP. Reductions that exceed quantity on
    hand fail without changing the balance or creating a movement.
27. Stock status rules are: no balance is `NOT_INITIALIZED`; zero is
    `OUT_OF_STOCK`; a positive quantity at or below its threshold is
    `LOW_STOCK`; a quantity above its threshold is `IN_STOCK`. With a zero
    threshold, any positive quantity is in stock.
28. OWNER may initialize, adjust, and change thresholds. CASHIER may read active
    product balances and their audit history but cannot mutate inventory.
29. Each stock change locks the balance, calculates from the persisted value,
    writes one movement, and updates the balance in one atomic transaction.
30. Movement history is immutable through APIs and admin. Product, shop, balance,
    and creator relationships use protected deletion.
31. Supplier, purchase, return, batch, expiry-batch, and warehouse movements are
    intentionally excluded. Completion creates one negative `SALE` movement per
    sale line.
32. Sales have `DRAFT`, `COMPLETED`, and `CANCELLED` states. Only a non-empty
    DRAFT can be completed; completed and cancelled sales are immutable through
    billing APIs.
33. OWNER may manage any draft in their shop. CASHIER may manage only drafts
    created by that cashier. Both roles are constrained to their own shop.
34. Draft line items snapshot product name, SKU, barcode, unit, selling price,
    tax rate, and tax-inclusion state. Later catalogue changes do not rewrite an
    existing line.
35. Billing quantities use three decimal places. QAR amounts use two decimals
    with `ROUND_HALF_UP`; all calculations use Decimal and run on the server.
36. Tax-exclusive lines calculate tax on quantity × price. Tax-inclusive lines
    extract the tax portion from the gross line total. Sale totals equal the sum
    of stored calculated line values.
37. Adding or changing a draft line requires active, initialized, sufficient
    own-shop inventory. Drafts do not reserve stock, deduct balances, or create
    movements; availability is revalidated while locked during finalization.
38. Re-adding a product increases its existing draft quantity. Zero quantity is
    rejected; removing a line requires the explicit DELETE operation.
39. Cancellation retains line items and totals, records cancelling user/time,
    and is idempotent. Cancelled drafts cannot be edited.
40. Completion runs in one database transaction and locks the sale and inventory
    balances in deterministic product order. Insufficient stock rolls back the
    entire checkout.
41. `Payment.amount` is the amount allocated to revenue, never cash tendered.
    Allocations must exactly equal the sale total. Cash tender and change are
    retained on Sale; card records only an optional external-terminal reference.
42. Cash, card, and one cash-plus-card split are supported. Payment entries must
    be positive and each method may appear at most once.
43. Sale numbers are server-generated at completion as
    `NXP-{shop-prefix}-{YYYYMMDD}-{sequence}` using a locked shop/day sequence.
44. OWNER can complete any own-shop draft and read all own-shop completed sales.
    CASHIER can complete and read only their own sales. Cross-shop access is
    never allowed.
45. A completed Sale and its snapshot items are the receipt record; no separate
    receipt model is used. Refunds, returns, exchanges, and customer credit are
    outside this phase.
46. Dashboard day boundaries use the shop IANA timezone and `completed_at`.
    Ranges include local midnight and exclude the following midnight. Invalid
    timezone configuration safely falls back to `Asia/Qatar`.
47. Dashboard revenue, bill counts, items sold, top products, payment allocation,
    and trends include completed sales only. Drafts and cancellations never
    contribute.
48. OWNER dashboard metrics cover the current shop. CASHIER financial metrics
    and recent sales cover only sales created or completed by that cashier.
49. Dashboard inventory counts and previews include active products only.
    Missing InventoryBalance rows are “not initialized”; zero is out of stock;
    positive quantity at or below threshold is low stock.
50. Top products rank snapshot quantities for today by default, with an optional
    seven-day period. The seven-day trend includes today and explicit zero days.
    Neither calculation exposes purchase price, profit, margin, or COGS.
51. Reports are OWNER-only and always derive the shop from the authenticated
    user. Cashiers receive HTTP 403 and another shop’s identifiers never broaden
    access.
52. Report date filters are inclusive local dates converted into a half-open
    timezone-aware datetime range. Draft and cancelled sales are excluded.

## SaaS tenancy and lifecycle

47. One Shop is one tenant. All business and account-management queries derive
    the shop from the authenticated user.
48. New shops begin `PENDING_VERIFICATION`, advance to `ONBOARDING` after
    primary-owner email verification, and enter `TRIAL` when onboarding is
    completed.
49. `TRIAL` and `ACTIVE` permit normal operations. `PAST_DUE` permits operations
    during the configured grace policy. `SUSPENDED` preserves safe reads and
    blocks business mutations. `CANCELLED` preserves data and blocks tenant use.
50. Primary ownership is the protected `Shop.primary_owner` relationship.
    Normal role actions cannot transfer, deactivate, or demote it.
51. Active users and active products count toward plan limits. Limits are
    checked by backend services before creation/reactivation and invitation
    acceptance.
52. Subscription payments are not connected; lifecycle transitions are
    platform-admin operations in this foundation.
52a. Sales History and Reports reject an end date earlier than the start date;
     report ranges are limited to 367 calendar days.
53. Sales, product, payment, and cashier reports share date, cashier, category,
    and payment filters. Current inventory respects category only because stock
    is a present-time snapshot rather than a historical valuation.
54. Product reporting uses immutable SaleItem identity and value snapshots.
    Payment reporting uses allocated Payment amounts. Neither report uses
    purchase price or estimates profit.
55. The reports foundation does not provide exports, accounting, suppliers,
    purchases, refunds, forecasting, or cross-shop analytics.

No branches, subscriptions, or SaaS billing rules are part of this foundation.
