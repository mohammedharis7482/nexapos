# Test plan

Foundation tests cover public health access, Shop creation and defaults, owner
and cashier creation, role values, password hashing, shop relationships, required
shop assignment, duplicate username rejection within a shop, and reuse of a
username across shops.

Run checks without changing the database:

```bash
cd backend
.venv/bin/python manage.py check --settings=config.settings.development
.venv/bin/python manage.py makemigrations --check --dry-run \
  --settings=config.settings.development
```

After PostgreSQL exists and initial migrations have been reviewed and applied:

```bash
.venv/bin/python manage.py test --settings=config.settings.development
```

Database tests cannot honestly pass until a PostgreSQL role can create or access
the Django test database. Future protected API endpoints must add an explicit
unauthenticated-access test; no sample business endpoint was created solely to
satisfy that optional test.
