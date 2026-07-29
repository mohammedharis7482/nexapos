# Frontend architecture

Billing checks the current shift before preparing a draft and routes to
`/shift` when none is open. The backend completion service remains
authoritative. Shift opening, summaries, closing cash and variance use the
existing responsive cards, dialogs, money inputs, loading and error patterns.

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

Owner interfaces live at `/team` and `/settings/subscription`; self-service
profile controls live at `/account`. Onboarding is resumable at `/onboarding`.
No client cache library or browser authentication authority was introduced.

NexaPOS uses Next.js App Router with TypeScript, React, Tailwind CSS, and
Vitest. Session state lives in `AuthProvider`; business pages call one
authoritative fetch client and retain only page-local server data.

## API and authentication

`lib/api-client.ts` owns URL joining, trailing slashes, credentials, CSRF
initialization, JSON error conversion, and a configurable request timeout.
Unsafe mutations are never automatically retried. No JWT or session identifier
is stored in application code. A 401 emits one session-expired event; the auth
provider clears identity and the active draft ID. A 403 remains a local
permission error.

There is no React Query dependency or shared business-data cache. Consequently
there are no query keys or invalidation APIs; pages refresh affected resources
explicitly after mutations. Introducing a cache later requires user/shop-keyed
data and complete logout clearing.

## Rendering and failures

Protected routes sit behind `ProtectedBoundary` and the role-aware application
shell. API loading/error/empty states remain local. Unexpected rendering errors
use App Router error boundaries with a production-safe retry UI; the protected
boundary preserves the surrounding shell where possible, and `global-error`
covers root failures.

Lists are server-paginated. Billing search and cart remain eagerly loaded.
Charts use existing lightweight DOM/CSS rendering. The development design-
system route calls `notFound()` outside development/test.

## Production configuration

Only `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_API_TIMEOUT_MS` are public.
The Next build emits baseline security headers. CSP enforcement is deliberately
deployment-staged as described in [security-audit.md](security-audit.md).
