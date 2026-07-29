# Authentication data audit

Audit date: 2026-07-28. The audit used read-only ORM counts and did not print
emails, Shop IDs, usernames, token hashes, raw tokens, passwords, or sessions.

The local PostgreSQL database contained six tenants:

- five `UNVERIFIED_RECENT` registrations;
- one `HAS_BUSINESS_DATA` tenant;
- no inconsistent tenants;
- no expired or empty abandoned tenant that was automatically safe to remove.

No records were deleted. The tenant with business data must be preserved. A
developer may inspect one known test tenant with `cleanup_test_tenant`; the
command is a dry run unless `--confirm` is supplied.

Classification considers shop lifecycle, primary-owner verification,
subscription presence, users, products, inventory balances, stock movements,
drafts, completed sales, and payments. Invitations and account tokens are
reported but are not business data.
