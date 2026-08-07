# Product requirements

## Purpose

NexaPOS supports day-to-day billing and shop operations for small grocery shops
in Qatar. It prioritises fast cashier workflows, reliable financial records, QAR
currency, Qatar time, and operation by non-technical staff.

## Delivered scope

Shop configuration, owner/cashier access, products, inventory, draft billing and
sales, cash/card/split payments, cashier shifts, receipts, operational reports,
CSV export, and bulk product import. The `saas` layer adds registration,
onboarding, invitations, plans, and subscription state.

Shipped since:

- **Product images** - one optional JPEG/PNG/WEBP image per product, shown on
  the catalogue, inventory detail, billing grid, and cart lines, with a
  category-tinted placeholder when absent. Stored through Django's storage API,
  so a cloud backend is a config change.
- **Multi-pricing** - a product may be sold as a fixed-size, fixed-price packet
  or as a cashier-entered loose amount, both deducting one shared stock pool.
- **Installable web app** - manifest, icon set, and standalone launch, so the
  app can be added to an Android or iOS home screen. Installability only: no
  offline caching, because a POS showing stale prices or stock is worse than
  one that plainly reports no connection.
- **Multi-language names** - a shop may set one secondary language (English,
  Arabic, Malayalam, Hindi, Urdu) and give products and categories an optional
  second name. Billing search matches either language; the second name shows on
  billing cards, cart lines, and receipts. Product and category names only - app
  UI chrome stays English, and right-to-left rendering is confined to the
  elements holding that text.

Out of scope: branches, refunds/returns, purchasing and suppliers, payment
gateway processing, automated subscription charging, loyalty, payroll, and
advanced accounting. See `known-limitations.md`.

## Roles

- **Owner**: shop configuration, catalogue, inventory, team, reports, exports.
- **Cashier**: till workflows - billing, checkout, own shifts and own sales.

Exact permissions live in `authorization-matrix.md`.

Every operational record is scoped to a shop. Role checks never replace shop
ownership checks.
