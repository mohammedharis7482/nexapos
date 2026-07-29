# Backup and recovery

No backup is claimed merely by this document. Production must schedule encrypted
PostgreSQL backups, monitor completion, and retain daily backups for at least 30
days unless an approved policy requires longer.

Before migrations, create a restricted backup:

```bash
pg_dump --format=custom --no-owner --file=nexapos-pre-migration.dump nexapos
```

Restore only with production authorization into a new empty database, never
over a running database:

```bash
createdb nexapos_restore_test
pg_restore --clean --if-exists --no-owner --dbname=nexapos_restore_test nexapos-pre-migration.dump
```

Run migrations/checks, verify row counts and tenant isolation, then exercise
login, inventory, one historical receipt, reports, and shift reconciliation.
Perform a restore drill at least quarterly. A database restore recovers data;
application rollback deploys earlier code and is a separate decision. Confirm
backup age and take another backup before either operation.

The deployment owner—not the application repository—is responsible for
configuring and monitoring PostgreSQL backups.

## Release ownership and evidence

The release record must name a deployment owner and approver and record the
provider, automated-backup state, retention, latest successful backup, the
pre-migration backup identifier, encryption, and last restore-drill result.
Until recorded, backup status is **not configured** and release is blocked.
Enable provider-native encrypted daily backups before accepting application
traffic; repository documentation is not evidence that a backup ran.

## Minimum policy

- Automated encrypted daily backups, retained for at least 30 days.
- Point-in-time recovery where the database provider supports it; target a
  recovery-point objective appropriate to the shop’s maximum acceptable lost
  sales.
- An on-demand backup immediately before every schema migration.
- Separate access-controlled storage and restricted restore authorization.
- Backup success alerts reviewed by an assigned operator.

## Restore rehearsal

At least quarterly and before pilot sign-off:

1. Restore the selected backup into an isolated database.
2. Verify migration history and run Django system checks.
3. Compare shop, user, product, inventory, completed-sale, payment, and movement
   counts against the backup manifest.
4. Reconcile sampled sale totals with payments and stock movements.
5. Log elapsed recovery time and any manual intervention.
6. Destroy the isolated restored copy according to the data-retention policy.

Never “test” a restore over the active database.

## Incident recovery

Prefer code rollback when data remains compatible. Database restoration is a
last resort because it can erase valid sales created after the backup. Before
restoring, stop writes, preserve the current database, identify the incident
window, export post-backup sales if safe, obtain authorized approval, and plan
reconciliation. Validate login, inventory, one historical receipt, and
financial totals before reopening the tills.

This document is a required policy; it does not claim that any provider backup
or point-in-time recovery is currently configured.

## Application rollback

Stop writes, preserve logs, and take a new backup. Confirm schema compatibility
before deploying the previous backend and its matching frontend. Restore a
database only with explicit approval when code rollback cannot recover safely,
and restore into a new database rather than over the live one. Before reopening,
verify readiness, login, a historical receipt, inventory, shifts, and reports,
then reconcile sales in the incident window.
