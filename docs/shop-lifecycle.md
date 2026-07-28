# Shop lifecycle

| State | Access |
| --- | --- |
| PENDING_VERIFICATION | Public verification and recovery only |
| ONBOARDING | Primary owner may resume setup and use lightweight setup writes |
| TRIAL | Normal operations with plan limits |
| ACTIVE | Normal operations with plan limits |
| PAST_DUE | Warning plus normal operations during the current grace policy |
| SUSPENDED | Safe reads; business mutations blocked; owners retain subscription/account access |
| CANCELLED | Data retained; normal tenant access blocked |

New registration creates a trial subscription server-side while the Shop
remains pending verification. Verification advances the Shop to onboarding;
completion advances it to trial. Platform administrators change sensitive
subscription state through audited services. Reactivation never deletes or
recreates shop data.

Existing shops migrate to ACTIVE, onboarding-complete, receive the earliest
active OWNER as primary owner, and receive an example STARTER subscription.
