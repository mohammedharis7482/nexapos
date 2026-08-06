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

Shop registration runs in one database transaction creating the shop, its
primary owner, one trial subscription, one registration audit event, and (when
verification is required) one hashed verification token.

Email is sent **after** that transaction commits - there is no transactional
outbox. `send_templated_email` never propagates: it catches delivery failures
and returns safe metadata, so a failed send cannot roll back the tenant. The
response reports `email_delivery: EMAIL_DELIVERY_FAILED` and the pending tenant
stays recoverable via resend. No recurring deletion job is enabled.

Case-insensitive database uniqueness on nonblank registration emails closes the
concurrent duplicate-registration race; application validation supplies the
normal field-level response.

The Shop UUID is the stable tenant identifier used by the existing login
contract. It is intentionally visible on registration/verification results,
verification email, Account, and Shop Settings. It is immutable and is not a
credential: every request still requires authenticated session state, and
backend selectors derive tenant scope from `request.user.shop` rather than a
client-provided Shop ID.

`User.email_verified_at` is the only email-verification state. Public
registration leaves it null; token verification sets it atomically. Login
normalizes username using the same trim-and-lowercase manager rule used during
creation. Shop IDs are trimmed and parsed as UUIDs without reformatting the
stored identifier. Only a password-validated pending-registration owner
receives `EMAIL_NOT_VERIFIED`; invalid identifiers, usernames, or passwords
remain indistinguishable.

With `REQUIRE_EMAIL_VERIFICATION=False` (development default) the owner is
created verified/exempt and the shop starts at `ONBOARDING`; with `True`
(production default) the pending-verification lifecycle applies.

Automated payment collection, recurring charging, multi-branch operation,
impersonation, and custom permission builders are deliberately deferred.
