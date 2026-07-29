# Fresh SaaS setup

1. Seed plans with `python manage.py seed_plans`.
2. Start Django using development settings and the Next.js frontend.
3. Register a Shop at `/register-shop`.
4. Save the returned Shop ID and normalized owner username.
5. Continue to `/login`; the Shop ID is prefilled.
6. Sign in with the original password. Development opens onboarding
   immediately because verification is disabled by policy.
7. Complete or resume onboarding and continue to Dashboard.
8. Create local cashiers with the existing `create_cashier` management command
   or use email invitations when a real delivery backend is configured.

`Shop.primary_owner` identifies the one primary owner. The underlying role is
`OWNER`; primary-owner capabilities are derived from the relationship. Normal
owners may manage cashiers according to policy, while cashiers cannot manage
team or subscription settings.

No Shop, owner, demo credential, product, or inventory record is created by
plan seeding or database reset.
