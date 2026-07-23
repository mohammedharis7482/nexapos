# Product requirements

## Purpose

NexaPOS supports day-to-day billing and shop operations for small grocery shops
in Qatar. It must prioritize fast cashier workflows, reliable financial records,
QAR currency, Qatar time, and straightforward operation by non-technical staff.

## Confirmed MVP boundary

The planned MVP covers shop configuration, owner/cashier access, products,
inventory, billing and sales, payments, and operational reports. This foundation
phase implements only shop identity, user identity, platform configuration,
health monitoring, API documentation, and test scaffolding.

Branches, subscription plans, SaaS tenant administration, and generalized
enterprise workflows are out of scope. Product, inventory, sales, payment,
dashboard, and report behavior must be specified and implemented in later
approved phases.

## Roles

- Owner: manages the shop and, in future phases, operational configuration and
  oversight.
- Cashier: performs approved till workflows in future phases.

Every operational record must ultimately be scoped to a shop. Role checks never
replace shop ownership checks.
