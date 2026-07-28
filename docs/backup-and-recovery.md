# Backup and recovery

The deployment owner—not the application repository—is responsible for
configuring and monitoring PostgreSQL backups.

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

