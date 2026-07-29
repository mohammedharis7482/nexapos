# NexaPOS v1.0 release checklist

## Release blockers

- [ ] Production backend/frontend hosts selected and accessible.
- [ ] Managed PostgreSQL created; SSL requirements confirmed.
- [ ] Automated encrypted backups and retention verified.
- [ ] Pre-migration backup identifier and named release owner recorded.
- [ ] Backend production variables configured in the secret manager.
- [ ] Frontend API URL points to the HTTPS production API.
- [ ] Exact hosts, CORS/CSRF origins, proxy count, and cookies reviewed.
- [ ] Real SMTP delivery and email verification tested.
- [ ] Shared edge login rate limiting configured.
- [ ] Deploy check, migration plan, static collection, tests, OpenAPI, lint, and
      build pass in the release environment.

## Deployment and smoke test

- [ ] Deploy backend before frontend and verify health/readiness.
- [ ] Back up, apply the reviewed migrations once, and record output.
- [ ] Deploy frontend with the released API URL.
- [ ] Complete `production-smoke-test.md` and review safe logs/error rates.
- [ ] Take a post-release backup and record the release version.

Any unchecked blocker means **NOT READY**. Local tests alone do not authorize
deployment.
