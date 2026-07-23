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

No branches, subscriptions, or SaaS billing rules are part of this foundation.
