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

## Authentication status

JWT authentication is intentionally not configured. Stable Simple JWT 5.5.1
metadata supports Python 3.13 but lists Django support only through 5.2, not
Django 6.0. Choose a supported Django version before first migrations, wait for
confirmed support, or approve another maintained authentication implementation.
