# NexaPOS

Multi-tenant grocery POS SaaS for Qatar. Django 6 + DRF + PostgreSQL API,
Next.js 16 (App Router) + React 19 + Tailwind v4 frontend. Session-cookie auth.
Every Shop is an isolated tenant in one shared database.

## Commands

```bash
# Backend (from backend/, venv required - PostgreSQL only, no SQLite fallback)
source .venv/bin/activate
python manage.py test          # full suite
python manage.py check
python manage.py migrate
python manage.py runserver

# Frontend (from frontend/)
npm test                       # vitest
npm run lint                   # eslint
npx tsc --noEmit               # must stay clean
npm run dev

# Everything at once
docker compose up
docker compose exec backend python manage.py seed_demo_shop   # shared demo login
```

No CI, no Python linter/type-checker configured. Run the four checks above
manually before considering work done.

## Layout

```
backend/apps/{accounts,shops,products,inventory,sales,payments,reports,saas}
backend/common/          # shared: permissions, pagination, params, money, exceptions, views
frontend/src/{app,components,services,hooks,providers,types,schemas,lib}
```

`frontend/AGENTS.md` warns that this Next.js version differs from training
data - read `frontend/node_modules/next/dist/docs/` before writing Next code.

## Conventions

- **Tenant isolation**: every query filters by `request.user.shop`. Selectors
  own the scoping; never hand-roll a shop filter in a view.
- **Layering**: `selectors.py` reads, `services.py` writes, `api/views.py`
  parses requests and shapes responses only. Business logic in a view is a bug.
  (`payments` and `shops` predate this split; `reports` splits selectors into
  two modules.)
- **Responses**: `common/views.py::success_response`. Errors go through
  `common/exceptions.py::api_exception_handler` - see `docs/api-contracts.md`.
- **Permissions**: `common/permissions.py` (`IsOwner`, `IsCashierOrOwner`).
  `IsSameShop` is defined and tested but currently applied to no view.
- **Money**: `common/money.py` (`round_money`/`round_quantity`, ROUND_HALF_UP).
  Never use float for money or quantities.
- **Multi-step writes** are wrapped in exactly one `@transaction.atomic` and
  take row locks in a fixed order. Concurrency invariants are covered by
  `apps/*/test_concurrency.py` - read those before touching locking.

## Docs index

Read the specific file rather than scanning `docs/` - 45+ files live there.

| Topic | File |
| --- | --- |
| HTTP contracts, auth flow, error shape | `docs/api-contracts.md` |
| Numbered business rules (money, stock, sales) | `docs/business-rules.md` |
| Tenant/SaaS architecture | `docs/saas-architecture.md` |
| Frontend architecture | `docs/frontend-architecture.md` |
| Models and schema | `docs/data-model.md`, `docs/database-schema.md` |
| Who may do what | `docs/authorization-matrix.md` |
| Verification/registration policy | `docs/authentication-policy.md` |
| Security posture and residual risk | `docs/security-audit.md` |
| Design system (current) | `docs/design-system-v2.md` |
| Navigation and routes | `docs/navigation.md` |
| Known gaps | `docs/known-limitations.md` |
| Deploy | `docs/deployment.md`, `docs/deployment-checklist.md` |

Feature specifics: `cashier-shifts`, `held-bills`, `product-import`,
`receipt-and-reprint`, `csv-exports`, `payment-policy`, `onboarding-flow`,
`invitation-flow`, `shop-lifecycle`, `subscription-foundation`,
`user-management`, `email-delivery`.

Testing/QA: `test-plan`, `qa-matrix`, `manual-testing`, `grocery-pilot-test`.

## Scope boundaries

Implemented: catalogue, inventory, draft billing, cash/card/split checkout,
shifts, receipts, reports, CSV export, registration, onboarding, invitations,
subscription state.

Not implemented: refunds, returns, purchasing, suppliers, branches, payment
gateway processing, automated subscription charging. CARD records a confirmed
external-terminal result - NexaPOS never touches card credentials.
