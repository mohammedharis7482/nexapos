# NexaPOS

Core shop operation includes cashier/owner shifts, cash reconciliation, held
bills, cash/card/split tender recording, audited receipt reprints, and bounded
owner CSV exports. CARD records a confirmed external-terminal result; NexaPOS
does not process gateway payments or collect card credentials. See
`docs/core-pos-scope.md` and `docs/grocery-pilot-test.md`.

Email delivery and abandoned development registrations are operational
lifecycle concerns, not reasons to flush PostgreSQL. See
`docs/email-delivery.md`, `docs/registration-recovery.md`, and
`docs/development-test-tenant-cleanup.md`.

Local development uses the simpler verification-exempt registration policy
documented in `docs/authentication-policy.md`. A full, explicitly confirmed
local reset is available through `reset_development_data`; see
`docs/development-database-reset.md`.

NexaPOS is a production-oriented multi-tenant grocery point-of-sale and billing
SaaS application for small local grocery shops in Qatar. Each Shop is an
isolated tenant in a shared PostgreSQL database. The product includes owner and
cashier operations plus registration, onboarding, team invitations, account
recovery, trials, subscription state, and usage-limit foundations. It does not
include branches or automated subscription charging.

## Stack and repository

- `frontend/`: Next.js App Router, TypeScript, Tailwind CSS, and ESLint
- `backend/`: Python 3.13, Django 6, Django REST Framework, and PostgreSQL
- `docs/`: product, business, data, API, testing, and deployment decisions
- `design/`: design assets and decisions
- `infrastructure/`: deployment and infrastructure configuration

## Local development with Docker

The fastest way to run NexaPOS locally is Docker Compose, which starts
PostgreSQL, the Django API, and the Next.js frontend together with no manual
virtualenv or `npm install` step on the host.

**Prerequisite**: Docker Desktop (or Docker Engine + the Compose plugin)
installed and running.

```bash
docker compose build
docker compose up
```

The first `up` runs `python manage.py migrate` automatically before starting
the API, against a fresh PostgreSQL database that Compose waits to be
healthy before starting the backend at all. Once the logs settle:

- Frontend: <http://localhost:3000>
- Backend API: <http://localhost:8000/api/v1>
- API schema docs: <http://localhost:8000/api/docs/>
- PostgreSQL: `localhost:5432` (user `nexapos_user`, database `nexapos`,
  password `change-me` - published for connecting a local DB client only;
  these are fixed development-only credentials, not secrets)

Run `docker compose up -d` instead to run in the background, and
`docker compose logs -f backend` (or `frontend`, or `db`) to follow one
service's logs. `docker compose down` stops everything; add `-v` to also
delete the PostgreSQL volume and start from a completely empty database next
time.

Before public registration works, seed the example subscription plans (same
one-time step as the non-Docker workflow):

```bash
docker compose exec backend python manage.py seed_plans
```

### Shared demo login

To get a consistent demo shop and login without sharing real credentials or
a database, run this once after `docker compose up`:

```bash
docker compose exec backend python manage.py seed_demo_shop
```

| Field    | Value                                  |
| -------- | --------------------------------------- |
| Shop ID  | `1dab9df7-7675-41cc-9973-b2ce13aa547d` |
| Username | `mohammedharis`                         |
| Password | `haris7482`                             |

This is a fixed, shared, non-production credential documented here on
purpose so anyone with this repo can log in identically on their own
machine - it is not tied to any real personal data, and it is never used in
production. The command creates the shop through the same `register_shop()`
service function the public registration API uses (so it's a fully valid
shop with a real hashed password, an OWNER account, and a trial
subscription, not a shortcut), explicitly marks onboarding complete the same
way the app's own "finish onboarding" endpoint does (so login goes straight
to the dashboard), and adds a couple of sample categories and products so
the dashboard and billing screen aren't empty on first login. It only runs
with `DEBUG=True` and is safe to rerun: it checks for this exact shop ID
first and skips creation if it already exists, so it never errors or
duplicates. Running `reset_development_data` wipes it along with everything
else; rerun `seed_demo_shop` afterward to bring it back.

Run any other one-off Django management command the same way, for example:

```bash
docker compose exec backend python manage.py createsuperuser
docker compose exec backend python manage.py bootstrap_shop --shop-name "Al Noor Grocery" \
  --address "Doha, Qatar" --phone "+974 5555 0101" --username owner \
  --full-name "Shop Owner" --email owner@example.com
docker compose exec backend python manage.py test
```

Both `./backend` and `./frontend` are bind-mounted into their containers, so
code edits on the host take effect immediately (Django's dev server
autoreloads; Next.js fast-refreshes) without rebuilding the image. You only
need `docker compose build` again after changing a dependency
(`requirements/*.txt` or `package.json`), since those install during the
image build, not at container start.

The Docker environment always talks to the API at `http://localhost:8000`
from the browser and uses `db` (the Compose service name, not `localhost`)
as `POSTGRES_HOST` between containers on the internal network - see
`docker-compose.yml` for every environment variable it sets. It intentionally
mirrors `backend/.env.example` and `frontend/.env.example`'s development
defaults rather than replacing them; running the app without Docker (below)
still works exactly as documented.

The frontend container runs `next dev --webpack` instead of the default
Turbopack bundler. Turbopack's Rust filesystem layer does not reliably
resolve the `next` package across the anonymous `/app/node_modules` volume
mount used to keep the container's Linux-native dependencies from being
shadowed by the bind-mounted host directory, which surfaces as a
`Next.js package not found, version 0.0.0` crash on every request. This is a
Docker-only override in `docker-compose.yml`'s `command:`; `npm run dev`
outside Docker (below) is unaffected and still uses Turbopack.

## Local frontend

Docker Compose (above) is the recommended path and needs none of the steps
below. Use this manual setup only if you specifically want the app running
directly on the host instead of in containers.

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
NEXT_PUBLIC_API_TIMEOUT_MS=15000
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

Primary navigation is deliberately limited to Dashboard, New Bill, Products,
Inventory, Sales, Reports, and Settings, filtered by role. Current Shift is
contextual on Dashboard and New Bill; shift history lives under
`/sales/shifts`, and Team & Access lives under `/settings/team`. Temporary
redirects preserve `/shift`, `/current-shift`, `/shifts`, and `/team`.
See [navigation architecture](docs/navigation.md).

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

The frontend uses a consolidated operational design system. The current system
is [docs/design-system-v2.md](docs/design-system-v2.md); routes migrate to it
one at a time via [the migration guide](docs/design-system-v2-migration.md),
with [V1](docs/design-system.md) retained for un-migrated routes. Shared
semantic tokens, responsive page rhythm, accessible controls and dialogs,
role-aware navigation, consistent loading/empty/error states, and thermal
receipt print rules apply across the existing MVP. The complete viewport and
keyboard checklist is in [docs/manual-testing.md](docs/manual-testing.md).

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
The unauthenticated liveness endpoint is `/api/v1/health/`; database-aware
deployment readiness is `/api/v1/readiness/`.

Before public registration, create the example plan definitions:

```bash
python manage.py seed_plans
```

The command is idempotent and never overwrites existing commercial values.
Example prices are zero placeholders, not commercial commitments. Existing
shops are prepared automatically by the SaaS data migration; operators can
idempotently repair a specific shop with
`python manage.py bootstrap_subscription --shop-id <uuid>`.

Owners can optionally seed a development shop with a small catalogue:

```bash
python manage.py seed_catalogue --shop-id <shop-uuid>
```

The command is disabled unless `DEBUG=True`, requires an existing shop, is safe
to rerun, and never creates users, stock, or transactions.

For a ready-made, shareable demo shop and login instead of your own real
data, see `python manage.py seed_demo_shop` under
[Shared demo login](#shared-demo-login) above - it works the same way
outside Docker.

Inventory is initialized deliberately from `/inventory/{productId}` after a
product exists. This phase does not provide an inventory seeding command: stock
counts are operational data and must not be altered implicitly.

Owners can onboard an existing catalogue from **Products → Import Products**.
The downloadable UTF-8 CSV template and validator share one canonical
twelve-column contract. Validation is read-only for catalogue/inventory data;
confirmation uses explicit duplicate handling and one atomic PostgreSQL
transaction. See [Bulk product import](docs/product-import.md).

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
endpoint, clears in-memory state and the user-specific active draft identifier,
and returns to `/login`. Login is protected by application-level IP/context
throttles; production must also provide a shared reverse-proxy/platform limit.

## Production-readiness status

The repository has completed an application-level release audit, but is **not
ready to deploy** until production hosts/secrets, verified HTTPS cookie
topology, shared edge rate limiting, SMTP, and managed PostgreSQL backup
evidence are configured. Start with
[the release checklist](docs/release-checklist.md),
[the deployment checklist](docs/deployment-checklist.md),
[security audit](docs/security-audit.md), and [QA matrix](docs/qa-matrix.md).

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
