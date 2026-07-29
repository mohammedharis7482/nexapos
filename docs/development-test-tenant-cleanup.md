# Development test-tenant cleanup

Never flush PostgreSQL to recover an abandoned registration. Audit one known
tenant first:

```bash
python manage.py cleanup_test_tenant \
  --email placeholder@example.com \
  --settings=config.settings.development
```

The default is a dry run. For a confirmed disposable tenant with no business
data, repeat with `--confirm`.

The command requires exactly one email or Shop ID, refuses production and
`DEBUG=False`, runs atomically, and preserves unrelated tenants. It refuses
products, inventory, movements, drafts, completed sales, or payments unless
`--allow-business-data` is explicitly supplied. That destructive override is
only for a developer-confirmed disposable tenant.

After cleanup, register again with a fresh private password.
