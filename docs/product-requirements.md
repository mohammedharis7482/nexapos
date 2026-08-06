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

Out of scope: branches, refunds/returns, purchasing and suppliers, payment
gateway processing, automated subscription charging, loyalty, payroll, and
advanced accounting. See `known-limitations.md`.

## Roles

- **Owner**: shop configuration, catalogue, inventory, team, reports, exports.
- **Cashier**: till workflows - billing, checkout, own shifts and own sales.

Exact permissions live in `authorization-matrix.md`.

Every operational record is scoped to a shop. Role checks never replace shop
ownership checks.
