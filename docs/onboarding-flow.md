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
with one success panel, clears password controls, and directs the owner to
verify the submitted email before signing in. In development the console email
backend writes the verification message and URL to the Django server terminal;
it does not send a Gmail message. Refreshing the success page returns to a
blank registration form because completion state is intentionally not persisted
in browser storage.
