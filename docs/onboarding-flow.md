# Onboarding flow

Email verification unlocks a resumable primary-owner onboarding flow:

1. Welcome
2. Business profile
3. Regional and tax settings
4. Receipt setup
5. Catalogue guidance
6. Team invitation guidance
7. Ready to start

The backend persists an explicit current step and completion timestamp. Optional
steps may be skipped. Catalogue, inventory, and team management remain their
normal modules rather than duplicated onboarding implementations.

Existing shops are marked complete by migration and are never redirected
through registration or onboarding.

Registration completion is not authentication. The frontend replaces the form
with one success panel, clears password controls, and displays the safe Shop ID
with copy and sign-in actions. The verification email contains the shop name,
Shop ID, username, and one-time verification link. Verification success repeats
the Shop ID and links to `/login?shop_id=<UUID>`.

The login page validates the query UUID once. A valid query value takes
precedence over a remembered Shop ID but is not stored automatically. It is
persisted only after a successful login when Remember Shop ID is selected. A
malformed query is rejected with a field error and may fall back to a valid
remembered value. Username and password are never accepted from the URL.

In development the console email backend writes the verification message and
URL to the Django server terminal; it does not send a Gmail message. Refreshing
the registration success page returns to a blank form because completion state
is intentionally not persisted in browser storage.

Before verification, correct login credentials return safe verification
guidance rather than a misleading credentials error, but no session is
created. Verification atomically sets `email_verified_at` and advances the shop
from `PENDING_VERIFICATION` to `ONBOARDING`. The next successful owner login
returns lifecycle context, and the protected boundary sends an incomplete
primary owner to `/onboarding` without rendering protected dashboard content.
Existing migrated shops remain usable because the verification gate is tied to
the public-registration pending lifecycle; trusted owner-created cashiers and
invitation acceptance keep their documented verification policy. Accepting a
one-time email invitation marks that invited address verified; directly
owner-created cashiers are trusted accounts under the existing active-shop
policy. Authenticated session context reports `email_verified` without allowing
the client to change it.
