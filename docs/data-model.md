# SaaS data model

- `CashierShift`: shop/user shift history, opening and closing cash, expected
  drawer value, counted cash, and variance.
- `Sale.shift`: nullable for historical compatibility and assigned to new
  completed sales; HELD metadata preserves who held a bill and when.
- `Payment`: immutable allocation with optional tender/change, safe external
  terminal reference, recorder, and shift.

- `Shop`: tenant identity, lifecycle status, onboarding milestone, and protected
  one-to-one primary-owner reference.
- `User`: one Shop, stable OWNER/CASHIER role, active flag, verification and
  account-activity timestamps.
- `Plan`: simple limits and report entitlements.
- `ShopSubscription`: one current record per Shop with trial, billing-period,
  grace, and lifecycle dates.
- `ShopInvitation`: shop, normalized email, permitted role, hashed token,
  inviter, expiry, acceptance, and revocation.
- `EmailVerificationToken` and `PasswordResetToken`: unique token hashes,
  expiry, and one-time use timestamp.
- `AuditEvent`: bounded account/lifecycle event metadata without secrets.

Foreign keys use protective deletion for tenant and financial continuity.
Account tokens cascade with their user. Existing product, inventory, sale, and
payment schemas are unchanged.
