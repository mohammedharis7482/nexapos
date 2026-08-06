# Frontend architecture

Next.js App Router, TypeScript, React, Tailwind, Vitest. Session state lives in
`AuthProvider`; business pages call one authoritative fetch client and retain
only page-local server data.

There is **no** React Query or shared business-data cache - no query keys, no
invalidation API. Pages refresh affected resources explicitly after mutations.
Introducing a cache later requires user/shop-keyed data and complete logout
clearing.

## Billing and shifts

Billing checks the current shift before preparing a draft. With none open it
renders a focused guard with an Open Shift action - it does not create a draft
or enter a redirect loop. Canonical route is `/sales/shifts/current`; the
backend completion service stays authoritative. Dashboard issues a lightweight
current-shift request only; the shell never fetches shift history.

## SaaS routes and context

Public account routes are grouped with login and use one branded account
surface: `/register-shop`, `/verify-email`, `/forgot-password`,
`/reset-password`, and `/accept-invitation`. Tokens are read only to make the
required API call and are never persisted.

Authenticated context includes shop lifecycle, onboarding, subscription
summary, primary ownership, and presentation capabilities. The protected
boundary prevents content flashes and redirects onboarding, suspended, and
role-restricted sessions before rendering operational content. Backend
permissions remain authoritative.

Owner team management lives at `/settings/team`, subscription at
`/settings/subscription`, self-service profile at `/account`. Onboarding is
resumable at `/onboarding`.

## API and authentication

`lib/api-client.ts` owns URL joining, trailing slashes, credentials, CSRF
handling, JSON error conversion, and a configurable request timeout. The CSRF
token is cached in module memory from the `/auth/csrf/` response body, never
read from `document.cookie` (see `docs/api-contracts.md`). Unsafe mutations are
never auto-retried apart from a single retry after `403 CSRF Failed`. No JWT or
session identifier is stored in application code. A 401 emits one
session-expired event and the auth provider clears identity and the active
draft ID; a 403 stays a local permission error.

## Rendering and failures

Protected routes sit behind `ProtectedBoundary` and the role-aware application
shell. API loading/error/empty states remain local. Unexpected rendering errors
use App Router error boundaries with a production-safe retry UI; the protected
boundary preserves the surrounding shell where possible, and `global-error`
covers root failures.

Lists are server-paginated. Billing search and cart remain eagerly loaded.
Charts use existing lightweight DOM/CSS rendering. The development design-
system route calls `notFound()` outside development/test.

## Navigation modules

The seven-item owner sidebar uses boundary-aware parent matching, so `/sales/*`,
`/settings/*`, and `/products/*` retain the correct active primary item.
Sales supplies compact Transactions and Shifts secondary navigation. Settings
supplies Shop Profile, Team & Access, and Data Management. Cashiers see only
Dashboard, New Bill, Products, and Sales; their shift access is contextual and
the backend returns only their own shifts. Mobile keeps four primary actions
plus a role-filtered More sheet. See [navigation.md](navigation.md).

## Production configuration

Only `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_API_TIMEOUT_MS` are public.
Production builds require the API URL explicitly; localhost is only a
development/test fallback.
The Next build emits baseline security headers. CSP enforcement is deliberately
deployment-staged as described in [security-audit.md](security-audit.md).
