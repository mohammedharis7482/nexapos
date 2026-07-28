# SaaS architecture

Each Shop is one tenant in the shared PostgreSQL database. Users remain
single-shop members. Every business selector begins with `request.user.shop`;
there is no client-selectable tenant context, schema-per-tenant design, or
cross-shop membership abstraction.

Primary ownership is `Shop.primary_owner`, while daily authorization continues
to use stable OWNER and CASHIER role values. The `saas` app owns plans,
one-to-one current subscriptions, invitations, account tokens, and a small
high-value audit-event stream. It does not own POS calculations.

The authenticated session context exposes safe lifecycle, subscription summary,
primary-owner status, and display capabilities. Capabilities improve UI
decisions but never replace backend permissions.

Shop registration runs in one database transaction. It creates one shop, its
primary owner, one trial subscription, one registration audit event, and one
active hashed verification token. Email generation is part of that policy: if
the email backend raises an error, the transaction rolls back and the API
returns a sanitized server failure. Case-insensitive database uniqueness for
nonblank shop registration email addresses closes the concurrent
duplicate-registration race while preserving the existing user membership
rules; application validation provides the normal field-level response.

Automated payment collection, recurring charging, multi-branch operation,
impersonation, and custom permission builders are deliberately deferred.
