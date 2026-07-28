# Invitation flow

1. An authorized owner supplies email, permitted role, and optional name.
2. The backend checks tenant role, existing active users, duplicate pending
   invitations, and current user limit.
3. A random token is emailed; only its SHA-256 hash is stored.
4. Public preview reveals only shop name, invited email/role, inviter name, and
   expiry for a valid token.
5. Acceptance rechecks expiry, revocation, one-time use, username uniqueness,
   and seat limit inside a transaction, then creates the user in the invitation
   shop.

Resend rotates the token and expiry. Revoke makes it unusable. Raw tokens must
not be copied into logs, fixtures, documentation, or support tickets.
