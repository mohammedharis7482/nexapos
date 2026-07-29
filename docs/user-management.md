# User management

The primary owner can manage OWNER and CASHIER accounts. Normal owners can
manage CASHIER accounts only. Cashiers cannot access team APIs. All lists,
direct creations, edits, password resets, activations, and role changes are scoped to the actor’s
shop.

Safeguards prevent self-deactivation, primary-owner deactivation or demotion,
cross-shop action, direct primary-owner promotion, and activation above the
plan seat limit. Direct staff accounts are active immediately and receive a
temporary password through an administrator-controlled, write-only API input.
The stored password is always hashed and is never returned. The user is limited
to account-security endpoints until replacing it. Profile email changes follow
the existing verification policy; self-service password changes preserve the
current session, while an owner reset invalidates every target-user session.

The Team page uses `/api/v1/team/users/`. It supports shop-scoped search plus
role and derived-status filters. Primary owners may create and manage owners or
cashiers. Other owners may create and manage cashiers only. Inactive users do
not consume plan seats; activation and direct creation enforce the active-user
limit atomically.

Account state is derived rather than duplicated:

- `ACTIVE`: `is_active=True`, no required password change.
- `INACTIVE`: `is_active=False`.
- `PASSWORD_CHANGE_REQUIRED`: active with `must_change_password=True`.

Audit events record the actor, target, shop, event type, and time. Passwords,
session identifiers, CSRF values, and authentication request bodies are never
audit metadata.

Ownership transfer is intentionally deferred, but the explicit relationship
allows a future transactional transfer service.
## Development cashier creation

Primary owners and permitted owners retain the existing team policies.
Development can create an immediately active cashier with `create_cashier`;
the command validates the plan user limit, Shop-scoped username, and password,
and never prints the password. Email remains optional. Primary ownership is
represented by `Shop.primary_owner`, not a third stored role.
