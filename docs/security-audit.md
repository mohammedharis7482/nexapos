# Security audit

## Result

The application security posture is suitable for a controlled staging/pilot
after the deployment conditions below are met. It must not yet be described as
production-ready because provider-level rate limiting, backup verification,
HTTPS topology, HSTS, CSP rollout, and restore testing are external decisions.

## Authentication and sessions

- Django session authentication is authoritative; no token or password is kept
  in browser storage.
- Login requires CSRF, rotates the session identifier, and returns a generic
  failure for wrong shop, username, password, inactive user, or inactive shop.
- Existing sessions are now invalidated when their shop becomes inactive.
- Logout invalidates the server session. The frontend clears the user and
  active draft identifier while intentionally retaining only the non-sensitive
  remembered Shop ID.
- The default session lifetime is eight hours and is not renewed on every
  request. Deployments may opt into sliding renewal explicitly, but should not
  do so without an inactivity/session policy for shared tills.
- Password serializers are write-only and responses omit password/session data.
- Login has two DRF throttles: 30 attempts/minute by IP and 10/minute by a
  SHA-256-derived IP/shop/username context. These use Django’s cache and are
  defense-in-depth, not a replacement for shared edge limits.

Production must enforce a shared edge rule before traffic reaches Django:
limit `POST /api/v1/auth/login/` per source IP, add a lower sustained rate and
a reasonable burst, return 429 without account detail, and monitor rejects.
Exact thresholds must be tuned from pilot traffic; start no looser than the
application limits.
Set `DRF_NUM_PROXIES` to the exact number of trusted proxies only after the
edge strips client-supplied forwarding headers. The safe default is zero, which
uses the direct peer address.

## Cookies, CORS, CSRF, and topology

The expected deployment is same-site HTTPS, preferably frontend and API on
subdomains of one registrable domain. Production defaults use Secure,
HttpOnly session cookies and `SameSite=Lax`; CSRF cookies remain script-readable
because the SPA sends `X-CSRFToken`.

If truly cross-site domains are selected, set both cookie SameSite values to
`None`, keep Secure enabled, explicitly list the frontend in CORS and CSRF
origins, and test every browser. Wildcard hosts and CORS origins are rejected.
Development remains HTTP localhost with non-secure cookies.

## Request and error safety

Every response receives a random `X-Request-ID`. Unexpected API exceptions now
return the standard generic JSON envelope and are logged with safe correlation
fields. Production logging is JSON by default. Passwords, sessions, CSRF
tokens, request bodies, and terminal-sensitive data are not logging fields.

The audit also found and corrected a sale-state authorization defect: the
draft-cancellation service could accept a completed sale identifier. Billing
selectors now expose only draft/cancelled records to draft operations, the
service itself enforces the DRAFT state under its transaction lock, and a
regression test proves a completed sale remains completed with its payment and
SALE movement intact.

## Headers and CSP

Django uses frame denial, content-type nosniff, and same-origin referrer policy.
Next.js sends frame denial, nosniff, same-origin referrer policy, COOP, and a
restricted Permissions Policy.

An enforcing CSP is deferred. Next.js currently requires deployment-aware
script/style handling; introducing a guessed policy risks breaking hydration.
Start in `Content-Security-Policy-Report-Only` on staging, capture violations,
then adopt nonce/hash-based `script-src`, explicit API `connect-src`, `img-src
'self' data:`, `object-src 'none'`, `base-uri 'self'`, and `frame-ancestors
'none'`. Do not promote enforcement before login, billing, charts, and print
flows pass.

## Secrets and test data

No real credentials belong in source, fixtures, or documentation. Test
passwords and seed catalogue records are synthetic. `seed_catalogue` refuses to
run unless `DEBUG=True`. Environment examples contain placeholders only.

## Remaining deployment conditions

1. Configure shared edge login throttling.
2. Validate exact public hosts/origins and HTTPS proxy behavior.
3. Decide and stage HSTS; defaults intentionally leave it disabled.
4. Complete CSP report-only evaluation.
5. Configure centralized encrypted logs with access/retention controls.
6. Complete a backup restore rehearsal.

## SaaS account security

Verification, invitation, and password-reset secrets use cryptographically
secure random values and SHA-256 hashes at rest. They expire, are single-use,
are never returned by APIs, and are excluded from admin displays and structured
logging. Public resend/reset responses do not reveal whether an account exists.
Registration, acceptance, role changes, activation, and subscription
transitions are transactional and backend-authoritative. Public account routes
have a separate throttle; shared edge controls remain required.

Shop IDs are tenant identifiers, not secrets or authentication factors. They
may appear in registration and verification responses, verification email,
login handoff URLs, and authenticated account/settings views. A Shop ID alone
cannot authenticate a user or select authorization scope: username, password,
CSRF/session controls, lifecycle rules, and server-derived `request.user.shop`
remain authoritative. Passwords and raw account tokens never accompany the
Shop ID in URLs or API responses.

The verification-specific login response is credential-gated: Django first
resolves the user inside the submitted shop and validates the password. Only
then may `EMAIL_NOT_VERIFIED`, inactive-account, or terminal shop-state guidance
be returned. Wrong Shop ID, username, or password always uses
`INVALID_CREDENTIALS`. Denied attempts create no session. Development logs use
reason categories at debug level and never include passwords, request bodies,
session identifiers, or account tokens.
