# NexaPOS QA matrix

This matrix records the July 2026 production-readiness audit. “Automated”
means a repository test exists; it does not replace the listed pilot check.

| Feature | Role | Expected behaviour | Automated coverage | Manual requirement | Risk | Audit result | Remaining concern |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Login and session | OWNER/CASHIER | Generic failures, rotated session, inactive users/shops denied | CSRF, generic failure, session rotation/invalidation, throttling, inactive state | Expiry and multi-device behavior over deployed HTTPS | Critical | Pass | Edge rate limiting must supplement application throttles |
| Product authority | OWNER writes; both read | Shop-scoped catalogue; server owns billing price/tax snapshots | Cross-shop UUID, role, SKU/barcode, price-override tests | Edit while another till has a draft | Critical | Pass | Search latency needs production measurement |
| Opening stock | OWNER | One initialization, atomic balance and movement | Duplicate, cross-shop, validation, atomicity | Physical-count workflow | Critical | Pass | Real concurrent requests were not load-tested |
| Stock adjustment | OWNER writes; both read | Locked balance, immutable movement, no negative stock | Direction, sequential updates, insufficient balance, role/isolation | Damage/expiry/correction sign-off | Critical | Pass | Database-level relationships also rely on service boundary |
| Draft billing | OWNER/CASHIER | Cashier sees own drafts; server calculates every line | Ownership, isolation, snapshots, malformed quantities, totals | Barcode scanner and long cart | Critical | Pass | Browser/device performance pending |
| Sale completion | OWNER/CASHIER | Atomic, single completion, immutable after completion, deterministic stock locks | Payments, rollback, duplicate attempt, completed-sale cancellation rejection, inventory deduction, server recalculation | Two-till contention trial | Critical | Pass; completed-sale cancellation defect corrected | True simultaneous concurrency needs staging/load tooling |
| Payments | OWNER/CASHIER | Positive allocations exactly reconcile; no sensitive card data | Cash/card/split, under/over allocation, change, immutable records | Terminal-reference procedure | Critical | Pass | External terminal reconciliation remains operational |
| Receipts | OWNER and owning CASHIER | Snapshot details and allocated payments only | Cross-shop/other-cashier denial and response accuracy | 80mm/A4 print on pilot hardware | Critical | Pass | Printer/browser combinations pending |
| Sales history | OWNER shop-wide; CASHIER own | Completed-only, bounded pagination, valid range | Isolation, filters, reversed dates, bounded query count | Large history navigation | High | Pass | Production query latency pending |
| Dashboard | OWNER shop-wide; CASHIER own | Completed-only bounded operational summary | Scope, reconciliation, alerts, zero days, five-row limit | Refresh after a real sale | High | Pass | No caching; aggregation scale must be monitored |
| Reports | OWNER | Shop-scoped DB aggregation and bounded detail rows | Permissions, cross-shop, filters, reconciliation, 367-day limit | Large permitted range | High | Pass | Synchronous aggregation may need future optimization |
| Shop settings | OWNER writes; both read | Only current shop, validated tax/settings | Roles, isolation, invalid values | Receipt details after update | High | Pass | Logo/media storage is deployment-specific |
| API failures | All | Stable safe envelope; no stack/database details | Validation contract and unexpected-error contract | Reverse-proxy 502/timeout behavior | High | Pass | Central external log collection not configured |
| Readiness | Deployment | Liveness is cheap; readiness checks DB safely | Success and safe 503 tests | Probe from deployment network | High | Pass | Provider probe timing must be configured |
| Frontend session state | All | One `/me`, 401 clears user/draft, 403 preserves session | Strict Mode, 401, 403, network, logout storage | Expired session mid-checkout | High | Pass | No React Query/cache layer exists |
| Production configuration | Operator | Explicit hosts/origins, HTTPS cookies, secure headers | Django deploy check and Next build | Validate real topology/env | Critical | Conditional | HSTS and CSP require deployment decision |
| Backup and rollback | Operator | Tested recoverable backups and code rollback | Documentation only | Restore rehearsal required | Critical | Pending | No provider backup is configured by this repository |
