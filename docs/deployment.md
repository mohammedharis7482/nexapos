# Deployment and environment

## Environment variables

Copy `backend/.env.example` for development. Required PostgreSQL variables are
`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, and
`POSTGRES_PORT`. Django also uses `DJANGO_SETTINGS_MODULE`,
`DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`,
`CORS_ALLOWED_ORIGINS`, and `CSRF_TRUSTED_ORIGINS`.

Production must set `DJANGO_SETTINGS_MODULE=config.settings.production`, a
strong secret, explicit hosts, and explicit origins. HTTPS redirect, secure
cookies default on. HSTS intentionally defaults off until the real domain and
subdomain policy are verified; `DJANGO_SECURE_SSL_REDIRECT`,
`DJANGO_SESSION_COOKIE_SECURE`, `DJANGO_CSRF_COOKIE_SECURE`,
`DJANGO_SECURE_HSTS_SECONDS`, `DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS`, and
`DJANGO_SECURE_HSTS_PRELOAD` allow controlled local validation and rollout.
Cookie SameSite values, trusted proxy handling, database SSL, login throttle
rates, and JSON logging are also environment-configurable in `.env.example`.

## PostgreSQL on macOS with Homebrew

```bash
brew install postgresql@17
brew services start postgresql@17
psql postgres
```

In `psql`, replace the sample password before use:

```sql
CREATE ROLE nexapos_user WITH LOGIN PASSWORD 'change-me';
CREATE DATABASE nexapos OWNER nexapos_user;
\q
```

On Debian/Ubuntu, install and start PostgreSQL with:

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl enable --now postgresql
sudo -u postgres psql
```

Then run the same SQL. For development tests, the role may need `CREATEDB`:

```sql
ALTER ROLE nexapos_user CREATEDB;
```

## First migration

Only after environment values and both models have been reviewed:

```bash
cd backend
.venv/bin/python manage.py makemigrations shops accounts
.venv/bin/python manage.py migrate
```

Use `collectstatic --noinput` during production release and serve the Django
application with Gunicorn behind a TLS-terminating reverse proxy.

Before applying migrations, take and record a verified backup, run
`migrate --plan` against the release configuration, and confirm the migration
remains compatible with the currently deployed code. Follow
[deployment-checklist.md](deployment-checklist.md) and
[rollback-plan.md](rollback-plan.md); never point a validation command at an
unreviewed production database.

## Authentication compatibility decision

Simple JWT 5.5.1 is not installed. Its published metadata supports Python 3.13
and Django 4.2 through 5.2, while NexaPOS currently uses Django 6.0.7 and DRF
3.17.1. Because Django 6 support is not officially confirmed, JWT was not added.
Before migrations, either move to a supported Django version, wait for official
Simple JWT support, or approve assessment of another maintained implementation.
