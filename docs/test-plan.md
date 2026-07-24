# Test plan

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
