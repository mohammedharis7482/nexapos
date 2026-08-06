# Performance audit

## Database and API

Critical list selectors are shop-scoped and paginated with a default of 25 and
a hard maximum page size of 100. Ordering includes deterministic secondary keys
where needed. Dashboard previews are bounded to five rows; report detail lists
are bounded to 50 rows and report ranges to 367 calendar days.

Products and inventory use `select_related`; sales detail/history prefetch
items and payments. Sale completion locks the draft, sorts and locks item and
inventory rows by product ID, then performs all deductions and payments in one
transaction. Reports use PostgreSQL aggregation rather than frontend totals.

A regression test verifies that sales-history query count remains at most ten
as returned rows increase. No speculative index migration was added: existing
indexes cover shop/status/completion time, shop/creator time, SKU, barcode,
active catalogue rows, stock movement history, and payment method/time.

## Known scaling limits

- Dashboard and reports execute synchronous aggregate queries per request and
  have no cache. This is appropriate for the pilot dataset but must be measured
  using production-like volumes.
- Case-insensitive contains searches cannot fully exploit ordinary B-tree
  indexes. PostgreSQL trigram/search indexing should only be considered after
  measured catalogue-search degradation.
- No realistic simultaneous-till load test was available. Row-lock ordering is
  code-reviewed and threaded concurrency tests cover correctness
  (`apps/*/test_concurrency.py`), but staging contention/latency testing under
  production-like volume remains required.

## Resolved

- `inventory_summary` collapsed four count queries into one conditional
  aggregate.
- Shift list no longer computes summaries per row (was ~3 queries per shift);
  `bulk_shift_summaries` uses a fixed query count per page.
- CSV exports apply their row limit in SQL instead of materialising the table.
- `ReportsView` resolves its filtered sale set once instead of once per report
  section.
- Sale numbering locks the per-shop/day sequence row rather than the whole
  `Shop` row, so registers no longer serialise against each other.

## Frontend

There is no React Query or global data cache. Pages use bounded server results,
local mutation state, and explicit refreshes, so there is no cross-user query
cache to clear. Authentication initialization is guarded against Strict Mode
duplicates. A 401 clears in-memory identity and active-draft browser state; a
403 remains a permission error.

The dependency set contains no charting framework or large client state
library. Charts are CSS/DOM-based, lists are paginated, and critical billing
controls are not lazy-loaded. The production build is the authoritative bundle
health check; no analyzer package was added.

## Measurement status

Automated correctness and bounded-query checks are recorded, but no latency
figures are labeled as measured. Use [performance-targets.md](performance-targets.md)
to capture staging and production results with dataset size, hardware, network,
percentile, and timestamp.

