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
npm run dev
```

The frontend runs at `http://localhost:3000`. No dashboard or business feature
was added as part of the foundation work.

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

## Session authentication

NexaPOS uses Django server-side sessions with an HttpOnly session cookie and
CSRF protection. JWT and Simple JWT are intentionally not installed.

Cookies explicitly use `SameSite=Lax`; production additionally uses `Secure`.
Because `localhost` and `127.0.0.1` are different browser cookie sites, expose
the backend through a same-origin Next.js development rewrite/proxy when the
browser page is `http://localhost:3000`. Django may continue listening on
`http://127.0.0.1:8000`.

To connect the Next.js development frontend through that proxy:

1. Fetch `GET /api/v1/auth/csrf/` with `credentials: "include"`.
2. Read the non-HttpOnly `csrftoken` cookie.
3. Send it as `X-CSRFToken` on every unsafe request.
4. Use `credentials: "include"` on every authenticated request.
5. Treat HTTP 401 as an expired or missing session and redirect to login.

Login requires a shop UUID, username, and password. It returns safe user/shop
profile data; it never returns the server-side session identifier.

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
