# Rollback plan

## Triggers

Rollback when authentication is broadly unavailable, completed sales are
incorrect or duplicated, inventory deductions are inconsistent, data isolation
is breached, migrations fail irrecoverably, or error rate remains above the
agreed threshold after bounded remediation.

## Code rollback

1. Stop further release changes and appoint one incident lead.
2. Preserve logs, release identifiers, and database state.
3. If schema compatibility permits, deploy the last verified backend and
   frontend artifacts without restoring the database.
4. Run liveness/readiness, login, permission, sale-history, receipt, and
   inventory checks.
5. Reconcile every sale created during the incident window.

Frontend and backend may be rolled back independently only when their API
contract versions remain compatible.

## Migrations and data

Review each migration’s reverse operation before deployment. Prefer a forward
fix or compatible code rollback for additive migrations. Never reverse a
destructive/data-transforming migration blindly.

Restore a database only when corruption or an incompatible irreversible schema
change makes code rollback insufficient. A restore must preserve the pre-
restore database and account for valid sales created after the selected backup;
otherwise restoration would create financial and stock loss.

## Communication and validation

Tell the shop when billing must pause, what data window is under review, and
when operations may resume. After rollback, validate OWNER/CASHIER access, one
known receipt, inventory totals, recent sales, dashboard, reports, and error
rates. Record root cause and corrective action before another deployment.

