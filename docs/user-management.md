# User management

The primary owner can manage OWNER and CASHIER accounts. Normal owners can
manage CASHIER accounts only. Cashiers cannot access team APIs. All lists,
edits, invitations, activations, and role changes are scoped to the actor’s
shop.

Safeguards prevent self-deactivation, primary-owner deactivation or demotion,
cross-shop action, direct primary-owner promotion, and activation above the
plan seat limit. Passwords are never collected by an inviting owner. Profile
email changes trigger reverification; password changes preserve the current
session, while password reset invalidates all sessions.

Ownership transfer is intentionally deferred, but the explicit relationship
allows a future transactional transfer service.
# Development cashier creation

Primary owners and permitted owners retain the existing team policies.
Development can create an immediately active cashier with `create_cashier`;
the command validates the plan user limit, Shop-scoped username, and password,
and never prints the password. Email remains optional. Primary ownership is
represented by `Shop.primary_owner`, not a third stored role.
