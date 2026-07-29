# Authentication data audit

Audit updated: 2026-07-29. The audit used read-only ORM counts and did not print
emails, Shop IDs, usernames, token hashes, raw tokens, passwords, or sessions.

Before the authorized full development reset, the local PostgreSQL database
contained seven Shops, eight users, seven subscriptions, fifteen products,
eighteen sales, seventeen payments, and twelve verification tokens. Some
tenants contained business data, so the earlier targeted-cleanup workflow did
not delete them.

The explicitly authorized `reset_development_data --confirm` execution removed
all tenant and business records, sessions, and Plans inside one transaction,
then reseeded three example Plans. Migration history and schema remained.

Post-reset verification found zero Shops, users, subscriptions, products,
inventory balances, movements, sales, payments, invitations, and verification
tokens, plus three Plans. A subsequent clean-flow validation intentionally
created one Shop, one primary owner, one cashier, and one subscription with no
verification token.

Classification considers shop lifecycle, primary-owner verification,
subscription presence, users, products, inventory balances, stock movements,
drafts, completed sales, and payments. Invitations and account tokens are
reported but are not business data.
