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
