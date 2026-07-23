# Test plan

Foundation tests cover Shop/User models plus session authentication, CSRF cookie
initialization and enforcement, owner/cashier login, invalid and cross-shop
credentials, inactive users and shops, username reuse across shops, session
creation and rotation, current-user access, logout invalidation, password
validation and session preservation, safe response fields, reusable permissions,
and transactional shop bootstrap behavior.

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
  --file /tmp/nexapos-auth-schema.yml \
  --settings=config.settings.development
```
