# SaaS data model

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
