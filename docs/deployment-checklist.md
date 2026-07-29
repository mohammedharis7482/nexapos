# Deployment readiness checklist

## Before deployment

- [ ] Release reviewed; no unrelated or secret files included.
- [ ] Backend tests, frontend tests, lint, build, OpenAPI, migration drift, and
      `check --deploy` reviewed.
- [ ] Production secret key, PostgreSQL credentials, hosts, frontend/API URLs,
      CORS, and CSRF origins configured in the secret manager.
- [ ] HTTPS proxy behavior and Secure/SameSite cookie topology tested.
- [ ] Shared edge login throttling configured.
- [ ] CSP report-only policy evaluated; enforcement decision recorded.
- [ ] Backup completed and restore procedure recently rehearsed.
- [ ] Migration plan reviewed; backwards compatibility confirmed.
- [ ] Django `collectstatic` output prepared for admin/static assets.
- [ ] Next.js production build artifact prepared.
- [ ] Health (`/api/v1/health/`) and readiness (`/api/v1/readiness/`) probes configured.
- [ ] Admin access restricted and MFA/SSO applied at the platform layer where available.
- [ ] Rollback owner and go/no-go authority identified.

## Deployment

- [ ] Decide whether a brief write-maintenance window is required.
- [ ] Record backup identifier and release identifier.
- [ ] Apply reviewed migrations once.
- [ ] Release backend, then frontend configured for the released API.
- [ ] Verify liveness, readiness, static assets, and safe logs.
- [ ] Validate CSRF initialization, OWNER login, CASHIER login, and logout.
- [ ] Complete one controlled sale smoke test and verify receipt, inventory,
      movement, history, and dashboard.

## After deployment

- [ ] Monitor 4xx/5xx/429 rates, latency, database connections/locks, and disk.
- [ ] Verify mobile layout and pilot receipt printer.
- [ ] Confirm cashier restrictions and owner reports/settings.
- [ ] Reconcile the smoke-test sale and remove it only through an approved
      business process—never direct database deletion.
- [ ] Make an explicit continue/rollback decision and record it.
# Authentication email delivery

- Configure a real non-console `DJANGO_EMAIL_BACKEND`.
- Store SMTP/provider credentials in the deployment secret store.
- Set `DJANGO_DEFAULT_FROM_EMAIL`, `FRONTEND_BASE_URL`, and
  `DJANGO_EMAIL_TIMEOUT`.
- Confirm TLS and SSL are not both enabled.
- Run the production deployment check and a provider delivery smoke test.
- Never run `cleanup_test_tenant` in production.

