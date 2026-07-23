# Business rules

1. A shop is the root boundary for business data.
2. A user belongs to exactly one shop; deleting a shop with users is protected.
3. Usernames are normalized to lowercase and unique within a shop, not globally.
4. The same normalized username may exist in different shops.
5. Every user password is set with Django password hashing. Raw passwords must
   never be stored or displayed by admin.
6. Roles are limited to `OWNER` and `CASHIER`. Superusers must be owners, active,
   and staff users.
7. New normal users require an explicit shop and default to cashier.
8. Shop defaults are QAR currency, `Asia/Qatar` timezone, and `INV` invoice
   prefix.
9. Disabled shops and users must be rejected by future business workflows.
10. Future queries and APIs must filter by the authenticated user's shop and
    must not accept an arbitrary client-provided shop as authorization.
11. Authentication uses a server-side Django session. Login rotates the session
    key, logout invalidates it, and unsafe requests require CSRF validation.
12. Inactive users and users belonging to inactive shops cannot log in.
13. Login failures do not distinguish an unknown shop, username, inactive
    account, or incorrect password.
14. Owners pass owner-only permission checks. Owners and cashiers pass shop
    staff checks. Superusers are owner-equivalent for role checks but remain
    constrained by `IsSameShop` in business APIs.
15. Object authorization derives the shop from the authenticated user and
    persisted object; client-provided shop IDs are never trusted for access.
16. There is no public registration. Initial shops and owners are created with
    the transactional `bootstrap_shop` command; subsequent controlled creation
    belongs to a later approved workflow.

No branches, subscriptions, or SaaS billing rules are part of this foundation.
