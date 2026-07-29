# Test plan

Core POS regression covers shift uniqueness/isolation, shift-required
completion, cash/card/split reconciliation, held/resumed bill behavior,
receipt-reprint immutability, and export authorization/formula safety.

Manual-product regression covers required normalized SKU, optional barcode,
same-shop uniqueness, cross-shop reuse, Decimal prices, negative-price
rejection, owner/cashier permissions, uninitialized inventory, one-time
opening stock, search/billing eligibility, and weighted quantity precision.

## SaaS foundation

PostgreSQL tests cover atomic registration, owner/password/trial creation,
hashed and one-time verification/reset/invitation tokens, generic public
responses, primary-owner protections, owner/cashier management boundaries,
shop isolation, invitation lifecycle, active-user/product limits, resumable
onboarding, subscription uniqueness, suspension behavior, and existing POS
regressions.

Frontend tests cover exact SaaS endpoint paths, lifecycle route decisions,
role-aware navigation, session-context clearing, and all existing operational
components. Manual acceptance must additionally exercise email links, mobile
forms, two-shop isolation, and platform-admin lifecycle transitions.

Registration regression coverage verifies HTTP `201` and the safe response
contract, exact record counts, rollback on validation or email-generation
failure, duplicate rejection without additional records, one POST for click,
double-click, and Enter flows, disabled pending controls, field/general error
clearing on retry, successful form replacement, password-control removal,
accessible focus, network retry, and mutual exclusion of success and error
states. Registration uses direct mutation calls with no automatic retry.

Shop ID handoff tests cover the UUID returned for only the newly registered
shop, matching email content, minimum verification response context, copy
feedback, registration/verification sign-in URLs, absence of credential URL
parameters, valid/malformed query behavior, valid-query precedence over
remembered state, opt-in persistence after login, and read-only Settings
visibility.

Verification-login regression additionally covers unverified-owner denial
without a session, credential-gated `EMAIL_NOT_VERIFIED`, generic invalid
credentials, inactive and terminal shop states, username/Shop-ID whitespace
normalization, verified first login lifecycle context, generic resend responses,
token supersession, verified-user resend suppression, distinct invalid/expired/
used token states, Strict Mode single verification, password clearing, and
verification-alert/resend UX.

Foundation tests cover Shop/User models plus session authentication, CSRF cookie
initialization and enforcement, owner/cashier login, invalid and cross-shop
credentials, inactive users and shops, username reuse across shops, session
creation and rotation, current-user access, logout invalidation, password
validation and session preservation, safe response fields, reusable permissions,
and transactional shop bootstrap behavior.

Catalogue tests additionally cover owner/cashier shop-settings permissions,
shop-ID rejection, category ordering and case-insensitive uniqueness,
cross-shop isolation, catalogue writes, per-shop SKU/barcode uniqueness,
cross-shop category rejection, price/tax validation, searches and filters,
barcode lookup, inactive visibility, and safe response fields.

Inventory tests cover one-time and zero opening stock, invalid quantities,
database uniqueness, every manual movement sign, insufficient-stock atomicity,
sequential persisted-balance adjustments, creator and before/after auditing,
last-movement timestamps, threshold changes, shop and role isolation, product
search/category/status filters, status edge cases, summary/low/out endpoints,
detail responses, and ordered paginated movement history. A true simultaneous
transaction test is not included; row-locking behavior is validated by service
implementation and sequential persisted-state tests.

Run checks without changing the database:

```bash
cd backend
.venv/bin/python manage.py check --settings=config.settings.development
.venv/bin/python manage.py makemigrations --check --dry-run \
  --settings=config.settings.development
```

Run the PostgreSQL-backed suite:

```bash
.venv/bin/python manage.py test --settings=config.settings.development
```

The PostgreSQL role must be able to create and destroy Django's temporary test
database. CSRF tests use Django's enforcement mode; CSRF is never disabled to
make tests pass.

Validate the documented schema:

```bash
.venv/bin/python manage.py spectacular \
  --validate \
  --file /tmp/nexapos-inventory-schema.yml \
  --settings=config.settings.development
```

## Bulk product import

- Validate the exact CSV header contract, UTF-8 parsing, size/row limits, decimal
  precision, status and unit choices.
- Verify blank SKU generation, optional barcode, intra-file duplicates, existing
  SKU/barcode matches, and cross-shop isolation.
- Exercise Skip, Update, and Cancel strategies.
- Verify category auto-creation, optional opening inventory, immutable existing
  stock, more than one processing batch, fatal rollback, history, and Cashier
  denial.
- Frontend tests cover multipart upload, trailing-slash routes, validation/error
  preview, duplicate selection, confirmation summary, one controlled failure,
  and owner-only rendering.
- Contract regression downloads the live template and uploads those exact bytes
  through the validation endpoint.
- Parser coverage includes BOM, UTF-8, quoted commas, trailing lines, bad
  delimiter/quoting, binary content, header aliases/errors, 5 MB and 10,000-row
  limits, formula-safe reports, every unit, tax/status normalization, exact
  barcodes, warnings, expiry/idempotency, and transactional rollback.

## Frontend authentication and shell

The frontend uses Vitest with jsdom and Testing Library matchers. Tests cover
login and password schemas, credentials inclusion, CSRF initialization and
headers, backend error parsing, authentication state initialization, successful
login state, logout clearing, protected loading and redirect decisions, and
OWNER/CASHIER navigation. Catalogue coverage includes shop/category/product
schemas, decimal string preservation, role controls, list states and filters,
exact service URLs, successful mutation refresh, and backend permission/field
errors.

Inventory frontend tests cover three-decimal schema validation, zero opening
stock, positive unsigned adjustment requests, exact service URLs, every status
label, loading/empty/error/ready collection states, expected-quantity previews,
successful mutation refresh callbacks, and insufficient-stock field errors.

Cashier-command tests cover secure manager-based creation, password hashing,
role/active state, safe output, inactive/invalid shops, same-shop duplicate
rejection, and cross-shop username reuse.

Draft-billing backend tests cover owner/cashier creation and visibility,
shop/cashier isolation, empty totals, product ID and barcode entry, duplicate
line accumulation, active/initialized/available stock checks, decimal quantity
updates, explicit removal, controlled input fields, product/price snapshots,
tax-inclusive and tax-exclusive rounding, aggregate totals, cancellation audit,
cancelled-draft protection, and absence of inventory movements.

Billing frontend tests cover positive decimal schemas, exact service paths,
product/barcode request format, cart rendering and controls, weighted steps,
workspace states, availability decisions, saved-draft reload, server totals,
exact barcode submission, and confirmed cancellation recovery.

Sale-completion backend tests cover owner/cashier permissions, shop isolation,
empty/cancelled/already-completed rejection, cash/card/split allocation, cash
change, invalid-payment rollback, unique sequenced sale numbers, inventory
deduction, per-line `SALE` movements, weighted quantities, total
recalculation, history filtering, and safe receipt responses. Database-backed
tests run against PostgreSQL.

Checkout frontend tests cover decimal-safe payment validation, cash change,
underpayment, card and split request shapes, duplicate-submit prevention,
failure preservation, successful completion, receipt rendering, sales service
URLs, and history filter state. Browser print layout is additionally verified
by inspecting the 80mm `@media print` rules; a physical printer is not part of
the automated suite.

Dashboard backend tests cover completed-sale-only daily totals, Decimal
averages and quantities, cash/card and split allocation, owner/cashier scope,
cross-shop isolation, active-product inventory alerts, top-product aggregation,
seven-day zero filling, recent-sale ordering/limits, unauthenticated denial, and
invalid-timezone fallback. These tests use PostgreSQL.

Dashboard frontend tests cover the exact consolidated service URL, page-aware
loading structure, owner/cashier greeting and commands, four role-specific
metrics, complete QAR values, seven-day totals/average/bill count, current-day
chart semantics, payment reconciliation, shortened visual sale numbers with
full accessible values, owner cashier context, mobile sale cards, all inventory
statuses, weighted top-product quantities, compact zero/healthy states, manual
refresh, plain-language failure and retry, and absence of invented comparisons.
Full lint, Vitest, and production build validation remain mandatory.

Dashboard transaction-preview regression covers expected and fallback short
references, today/previous-date shop-local formatting, owner/cashier metadata,
item counts, payment badges, non-wrapping totals, whole-row detail links,
accessible full references, compact empty/loading/error states, and absence of
management-table headers. Sales-page regression separately protects the full
sale number, complete table columns, filters, badges, aligned total, and View
link.

Reports backend tests cover unauthenticated and CASHIER denial, OWNER access,
completed-sale aggregation, weighted product quantities, current inventory
statuses, allocated split payments, cashier totals without line-join
duplication, shared filter combinations, inclusive zero-filled dates, invalid
date rejection, and cross-shop isolation.

Reports frontend tests cover the exact consolidated URL, default date range,
loading state, real sales metrics, switching all five responsive report views
without redundant requests, shared filter submission, and inventory-detail
links. Full regression tests, lint, build, OpenAPI validation, and migration
drift checks are run after implementation.

UI-foundation regression tests cover accessible button states and names, unique
dialog labelling, Escape cancellation, safe destructive confirmation, optional
empty-state actions, role navigation, and the refined draft/cart confirmation
flows. Existing page and service suites continue to protect authentication,
dashboard, catalogue, inventory, billing, payment, sales, receipt, reports, and
settings behaviour.

Page-audit regression additionally covers the shared native Select indicator
and change behavior, connected filter result/status context, shared pagination
counts and callbacks, exact report filter submission, formatted monetary and
quantity values, and the existing responsive desktop/mobile data structures.

Interaction regression covers viewport-constrained Dialog/Sheet anatomy,
non-dismissible critical mutations, safe confirmation focus, Escape focus
return in dropdown menus, date-input range constraints, native Select trigger
spacing, searchable-field clearing, semantic toast announcements and dismissal,
dynamic stock-adjustment action labels, payment duplicate-submit protection,
field-associated validation, and sticky shared action footers.

Production-readiness regression covers login IP/context throttling, invalidation
of sessions for inactive shops, generic unexpected-API failures, request IDs,
safe readiness success/failure, reversed Sales History dates, bounded
sales-history query counts, frontend request aborts, 401-versus-403 session
behavior, active-draft clearing, and route-level unexpected-error recovery.

Manual UI checks use [manual-testing.md](manual-testing.md) across 360–1440px,
keyboard navigation, reduced motion, mobile safe areas, dialogs, operational
states, browser console output, and both 80mm and A4 receipt print preview.

```bash
cd frontend
npm test
npm run lint
npm run build
```

The production build provides the TypeScript and App Router integration check.
No browser end-to-end suite is introduced in this phase; live Django/Next.js
interaction should be exercised when frontend deployment infrastructure is
defined.

Release validation additionally covers production-settings fail-closed
behavior, migration drift/plan review, WhiteNoise static collection, mandatory
production API URL, safe request-log fields, Team MVP copy and hidden invitation
UI, full PostgreSQL regression, OpenAPI, lint, Vitest, and production build.
Live HTTPS sessions, devices, printer/scanner, SMTP, backups, and cross-shop
browser checks remain mandatory on the selected host.
# Authentication delivery and cleanup coverage

Tests cover durable registration on delivery failure, delivery states, generic
duplicate recovery, token supersession, verification then login, console-mode
detection, token-free test email, cleanup dry run, confirmation, environment
refusal, and business-data refusal.

Development-policy coverage verifies immediate login, no token/email, one
Shop/owner/subscription, response handoff, and atomic validation/duplicate
failure. Reset coverage verifies dry run, production and `DEBUG=False`
refusal, related deletion, migration preservation, plan reseeding, idempotency,
and transaction rollback.
