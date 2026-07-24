# NexaPOS

NexaPOS is a production-oriented grocery point-of-sale and billing application
for small local grocery shops in Qatar. The MVP is a single-shop operational
system with owner and cashier roles. It does not include branches, subscription
billing, or a multi-tenant SaaS control plane.

## Stack and repository

- `frontend/`: Next.js App Router, TypeScript, Tailwind CSS, and ESLint
- `backend/`: Python 3.13, Django 6, Django REST Framework, and PostgreSQL
- `docs/`: product, business, data, API, testing, and deployment decisions
- `design/`: design assets and decisions
- `infrastructure/`: deployment and infrastructure configuration

## Local frontend

```bash
cd frontend
npm install
npm test
npm run lint
npm run dev
```

Create `frontend/.env.local` from the example when direct API requests are
required:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
```

This is the only public frontend environment value. It contains no backend
secret. The frontend defaults to the same URL when the variable is omitted.
Use `localhost` consistently for both applications so `SameSite=Lax` session
cookies work across development ports without a proxy or redirect.

The frontend includes real session login, a protected responsive shell,
role-aware navigation, shop settings, category management, and product catalogue
management. The inventory module adds decimal balances, one-time opening stock,
manual adjustments, low/out-of-stock tracking, and an immutable movement
history. Purchasing and suppliers remain outside this phase.
Draft billing now supports stock-aware product entry, server-calculated line
items and totals, owner/cashier draft permissions, cancellation, and a
responsive POS cart. Drafts do not reserve or deduct inventory. Checkout
supports cash, externally processed card, and cash/card split payments. A
successful atomic completion deducts inventory, writes one `SALE` movement per
line, records allocated payments, and exposes read-only sale history and an
80mm-friendly browser-print receipt. Refunds, returns, purchasing, sensitive
card capture, and payment-gateway processing are not implemented.

The protected dashboard is backed by real PostgreSQL aggregates at
`GET /api/v1/dashboard/`. Owners see shop-wide daily sales, allocated cash/card
payments, inventory alerts, recent sales, top products, and a seven-day trend.
Cashiers see only their own financial and recent-sale metrics plus the permitted
active-product alert preview. “Today” is calculated in the shop timezone
(`Asia/Qatar` by default), not from the application server’s local date.

The OWNER-only reports foundation is available at `/reports` and uses the
consolidated `GET /api/v1/reports/` API. It provides real sales, product,
inventory, allocated-payment, and cashier summaries with shared inclusive date,
cashier, category, and payment-method filters. Reports are operational views of
completed sales and current inventory; they do not calculate profit, COGS,
accounting entries, purchasing, or exports.

The frontend uses a consolidated operational design system documented in
[docs/design-system.md](docs/design-system.md). Shared semantic tokens,
responsive page rhythm, accessible controls and dialogs, role-aware navigation,
consistent loading/empty/error states, and thermal receipt print rules apply
across the existing MVP. The complete viewport and keyboard checklist is in
[docs/manual-testing.md](docs/manual-testing.md).

## Local backend

Create PostgreSQL as described in [deployment](docs/deployment.md), then:

```bash
cd backend
source .venv/bin/activate
pip install -r requirements/development.txt
cp .env.example .env
python manage.py check
python manage.py makemigrations accounts shops
python manage.py migrate
python manage.py test
python manage.py runserver
```

Review `.env` before migration. PostgreSQL is mandatory; SQLite is not a
fallback. Never change `AUTH_USER_MODEL` after the first migration.

API discovery is available at `/api/schema/`, `/api/docs/`, and `/api/redoc/`.
The unauthenticated liveness endpoint is `/api/v1/health/`.

Owners can optionally seed a development shop with a small catalogue:

```bash
python manage.py seed_catalogue --shop-id <shop-uuid>
```

The command is disabled unless `DEBUG=True`, requires an existing shop, is safe
to rerun, and never creates users, stock, or transactions.

Inventory is initialized deliberately from `/inventory/{productId}` after a
product exists. This phase does not provide an inventory seeding command: stock
counts are operational data and must not be altered implicitly.

## Session authentication

NexaPOS uses Django server-side sessions with an HttpOnly session cookie and
CSRF protection. JWT and Simple JWT are intentionally not installed.

Cookies explicitly use `SameSite=Lax`; production additionally uses `Secure`.
Local development uses `http://localhost:3000` for Next.js and
`http://localhost:8000` for Django. Do not mix `localhost` with `127.0.0.1`;
they are different browser cookie sites.

The frontend authentication flow is:

1. Fetch `GET /api/v1/auth/csrf/` with `credentials: "include"`.
2. Read the non-HttpOnly `csrftoken` cookie.
3. Send it as `X-CSRFToken` on every unsafe request.
4. Use `credentials: "include"` on every authenticated request.
5. Treat HTTP 401 as an expired or missing session and redirect to login.

Login requires a shop UUID, username, and password. It returns safe user/shop
profile data; it never returns the server-side session identifier.

After authentication, `/auth/me/` restores the in-memory user state on browser
refresh. The session cookie remains the source of truth; neither sessions nor
authentication tokens are stored in localStorage. Logout calls the Django
endpoint, clears in-memory state, and returns to `/login`.

Create the first shop and owner interactively:

```bash
cd backend
python manage.py bootstrap_shop \
  --shop-name "Al Noor Grocery" \
  --address "Doha, Qatar" \
  --phone "+974 5555 0101" \
  --username "owner" \
  --full-name "Shop Owner" \
  --email "owner@example.com"
```

The command prompts for the password without echoing it and refuses duplicate
shop names.

Create a cashier for an existing active shop:

```bash
cd backend
python manage.py create_cashier \
  --shop-id <shop-uuid> \
  --username cashier \
  --full-name "Counter Cashier" \
  --email cashier@example.com
```

The command prompts twice without echoing the password. Never pass passwords in
shell arguments or store them in shell history. It refuses inactive shops and
case-insensitive duplicate usernames within the selected shop.
