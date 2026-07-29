# Development database reset

`reset_development_data` removes local tenant, authentication, catalogue,
inventory, billing, sales, payment, audit, and session records while preserving
the PostgreSQL schema, Django migration history, content types, and permissions.
It then reseeds the three non-commercial example Plans.

Preview counts without changing data:

```bash
python manage.py reset_development_data \
  --settings=config.settings.development
```

Execute only after reviewing the destructive warning:

```bash
python manage.py reset_development_data --confirm \
  --settings=config.settings.development
```

The command refuses `DEBUG=False` and production settings. It is atomic and
safe on an already-empty database. By default all tenant-bound superusers are
removed. `--keep-superuser` explicitly recreates existing superusers inside a
development-only administration Shop; it does not reveal or reset passwords.

The reset never deletes migrations, source code, schema objects, Django content
types, permissions, or migration records.
