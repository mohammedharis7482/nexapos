# Authentication policy

NexaPOS uses Django sessions, CSRF protection, and Shop-scoped usernames. JWT
is not used.

`REQUIRE_EMAIL_VERIFICATION` controls only the public registration gate:

- Development defaults to `False`. Registration creates an active,
  login-ready primary owner, sets the Shop to `ONBOARDING`, sends no
  verification message, and creates no verification token.
- Production defaults to `True`. Registration creates a pending, unverified
  owner, creates one hashed expiring token, attempts delivery, and blocks login
  until successful verification.

The registration response exposes `verification_required` and `next_step`, so
the frontend does not infer behavior from its build environment. Session
context also exposes `email_verification_required`.

Owner email is trimmed and lowercased and is unique for public Shop
registration. Username is trimmed, lowercased, and unique within its Shop.
Invalid credentials remain generic.
