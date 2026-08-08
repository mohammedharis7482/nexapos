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
9. Disabled shops and users are rejected by business workflows.
10. Every query and API filters by the authenticated user's shop and never
    accepts a client-provided shop as authorization.
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
    `Asia/Qatar`; the default tax rate is between 0 and 100. Catalogue
    languages are the exception - both are owner-configurable (rule 22d).
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
    `BOX`, `CARTON`, `BOTTLE`, `CAN`, `BAG`, `CUP`, `JAR`, `ROLL`, `TRAY`, and
    `TUBE`.

### Product images

22a. A product image is optional. Every catalogue and billing surface falls back
     to a category-tinted placeholder, so a product without one is never broken
     or blank.
22b. Uploads are OWNER-only and accepted only as JPEG, PNG, or WEBP at 5 MB or
     less. The format is taken from the *decoded* image, not the filename or the
     client-supplied content type, so a renamed file is rejected on content.
22c. One image per product. Replacing deletes the previous file; the stored name
     is normalised to `<product-id>.<ext>` under `product-images/`.

### Second-language names

22d. A shop has `primary_language` (default English) and an optional
     `secondary_language`, both from one shared list: English, Arabic,
     Malayalam, Hindi, Urdu. They are independent of `country`, which stays
     free text and is never used to infer a language.
22e. Products and categories carry an optional `secondary_name`. Blank behaves
     exactly as before the feature existed - every surface falls back to the
     primary name.
22f. Billing and catalogue search match either language. The second name also
     appears on billing cards, cart lines, and as an optional receipt line.
22g. Second-language text is the only right-to-left surface. Layout, navigation,
     tables, reports and the document direction stay left-to-right; see
     `planned-features.md` for the full scope boundary.

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
34. Draft line items snapshot product name, second-language name, SKU, barcode,
    unit, selling price, tax rate, and tax-inclusion state. Later catalogue
    changes do not rewrite an existing line.
35. Billing quantities use three decimal places. QAR amounts use two decimals
    with `ROUND_HALF_UP`; all calculations use Decimal and run on the server.
36. Tax-exclusive lines calculate tax on quantity × price. Tax-inclusive lines
    extract the tax portion from the gross line total. Sale totals equal the sum
    of stored calculated line values.
37. Adding or changing a draft line requires active, initialized, sufficient
    own-shop inventory. Drafts do not reserve stock, deduct balances, or create
    movements; availability is revalidated while locked during finalization.
38. Re-adding a product increases the quantity of the line with the same
    pricing identity (product + mode + packet). A packet line and a loose line
    of the same product are separate lines. Zero quantity is rejected; removing
    a line requires the explicit DELETE operation.

### Multi-pricing (packet and loose)

38a. A product is STANDARD (default, unchanged) or MULTI. A MULTI product is
     sold either as a fixed packet or as a loose amount, and must define at
     least one packet.
38b. Packet size is expressed in the product's own `unit` - a 250 g packet of a
     KG product is `0.250`. There is no separate base unit and no conversion.
38c. Packet and loose sales deduct the same single InventoryBalance, so stock
     can never split into two disconnected numbers.
38d. A line's `quantity` is what is charged - packets for a PACKET line, units
     otherwise - and `stock_quantity` is what inventory deducts. A packet bills
     its exact fixed price rather than a derived per-unit rate. Reports and
     shift summaries sum `stock_quantity`; packet counts and weights are not
     commensurable. Any surface printing a quantity beside a unit must read the
     pricing mode: "2 kg" for two 250 g packets is a false statement on a
     receipt.
38e. Packets are sold in whole numbers. A packet size already referenced by a
     sale is deactivated rather than deleted, so completed sales keep resolving
     the definition they were billed under.
38f. Packet sizes are unique per product and must be positive; packet prices
     must be non-negative. A line snapshots `packet_size` at sale time, so
     editing a packet definition never rewrites what a past sale meant.
39. Cancellation retains line items and totals, records cancelling user/time,
    and is idempotent. Cancelled drafts cannot be edited.
40. Completion runs in one database transaction and locks the sale and inventory
    balances in deterministic product order. Demand is summed per product before
    it is compared to the balance, since one product may occupy several lines.
    Insufficient stock rolls back the entire checkout.
41. `Payment.amount` is the amount allocated to revenue, never cash tendered.
    Allocations must exactly equal the sale total. Cash tender and change are
    retained on Sale; card records only an optional external-terminal reference.
42. Cash, card, and one cash-plus-card split are supported. Payment entries must
    be positive and each method may appear at most once.
43. Sale numbers are server-generated at completion as
    `NXP-{shop-prefix}-{YYYYMMDD}-{sequence}`. The counter is a `SaleSequence`
    row per shop per day, locked with `select_for_update` for the increment, so
    concurrent checkouts get distinct contiguous numbers. The lock is scoped to
    that row deliberately - locking the `Shop` row instead would serialise every
    register in the shop against every other. Covered by
    `apps/sales/test_concurrency.py`.
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
51. Active users and active products count toward plan limits, checked by
    backend services before creation/reactivation and invitation acceptance.
    The check takes a `select_for_update` lock on the shop's `ShopSubscription`
    row first, so concurrent creates cannot all observe the same pre-insert
    count and all pass. Outside a transaction the check is advisory only (the
    `create_cashier` command relies on this, then re-checks under lock before
    inserting). Covered by `apps/saas/test_concurrency.py`.
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

## Bulk product import

- Bulk CSV import is owner-only, shop-scoped, and uses a validate-before-confirm
  workflow. Validation does not mutate the catalogue.
- Import SKU values may be blank; the importer generates a collision-resistant
  `AUTO-XXXXXXXXXXXX` SKU. It never generates barcodes.
- Missing category names are created within the importing shop during a
  successful confirmation.
- Existing-product strategies are Skip, Update, and Cancel. Update never
  overwrites an already initialized inventory balance.
- Blank opening stock leaves inventory uninitialized. An explicit zero creates
  an initialized out-of-stock balance.
- The template and parser use one canonical fifteen-column CSV contract: twelve
  required columns plus optional `Secondary Name`, `Image URL`, and `Packet
  Sizes`. A file omitting an optional column leaves that field untouched; the
  column present and blank clears it. Validation records expire after 24 hours
  and never create catalogue or inventory data.
- A non-empty `Packet Sizes` cell (`size@price` pairs separated by semicolons,
  sizes in the product's own unit) switches that product to multi-pricing and
  sets its packet order. Malformed syntax is a blocking row error naming the
  failing pair, never a silent downgrade to standard pricing.
- `Image URL` is fetched server-side under SSRF controls: http/https only,
  private, loopback, link-local and cloud-metadata addresses refused before
  connecting, re-checked from the live socket, capped redirects, and the same
  5 MB / JPEG-PNG-WEBP limits as manual upload, decided by decoding the bytes.
  Screening happens at validation with no transfer; the download happens after
  the import transaction commits. Any image failure is a row warning, so the
  product still imports without a picture.
- `Tax Exempt` maps to a zero Product tax rate. Human-readable unit names map
  through the single backend unit map; barcodes remain exact strings.
- Blocking errors prevent the whole import. Warnings are informational.
  Confirmation rechecks duplicates and is atomic and idempotent.
