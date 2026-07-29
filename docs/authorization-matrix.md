# Authorization and shop-isolation matrix

The authenticated user’s `shop` is the only tenant boundary. Business APIs do
not accept a shop selector. Cross-shop identifiers resolve as not found where
appropriate.

| Resource/action | OWNER | CASHIER | Isolation enforcement |
| --- | --- | --- | --- |
| Current session/logout/password | Own session | Own session | Django session and authenticated user |
| Shop settings read | Current shop | Current shop | `request.user.shop` |
| Shop settings update | Allowed | Denied | `IsOwner`; serializer cannot accept shop |
| Categories read | All current-shop rows | Active current-shop rows | Scoped selector |
| Categories create/update | Allowed | Denied | `IsOwner`; server assigns shop |
| Products read/search/barcode | All current-shop rows | Active current-shop rows | Scoped selector |
| Products create/update | Allowed | Denied | `IsOwner`; category must share shop |
| Inventory balances/summary | Read | Read active products | Product and balance selectors scoped to shop |
| Opening stock/threshold/adjustment | Allowed | Denied | `IsOwner`; locked shop/product lookup |
| Movement history | Read | Read active products | Product and movements both scoped |
| Draft create | Allowed | Allowed | Server assigns shop and creator |
| Draft read/update/cancel/complete | Any current-shop draft | Own drafts only | Scoped draft selector plus locked service lookup |
| Completed sales/history/receipt | Current shop | Own completed sales | Scoped completed-sale selector |
| Cashier filter list | Current-shop staff | Self only | Shop/user filter |
| Dashboard | Shop-wide | Own financial/recent-sale scope | Role-aware shop-scoped selectors |
| Reports | Allowed | Denied | `IsOwner`; all aggregations start from user shop |
| Shifts | All shop shifts | Own shifts only | Shop-scoped selector and cashier identity |
| Navigation to Settings / Team & Access / Data Management | Allowed | Denied | Protected route guard plus authoritative API permissions |
| CSV exports | Allowed | Denied | `IsOwner`; no client shop selector |
| Product import template, validation, history, confirmation, and error report | Allowed | Denied | `IsOwner`; validation/import IDs are shop-scoped |
| Team direct creation/edit/activation/reset | Manage cashiers; primary owner also manages owners | Denied | `request.user.shop`, role, seat-limit and primary-owner service checks |
| Onboarding | Primary owner only | Denied | Explicit `Shop.primary_owner` relationship |
| Subscription | Read; sensitive actions reserved to primary owner/platform admin | Denied | Current shop OneToOne subscription |
| Django admin | Staff/superuser only | Denied unless explicitly staff | Django admin permissions |

`PRIMARY_OWNER` is a capability derived from `Shop.primary_owner`, not a third
tenant role string. This preserves existing OWNER data while enforcing exactly
one primary owner at the database relationship level. Platform administrators
are Django staff and are not tenant roles; impersonation is not implemented.

Model `clean()` methods protect cross-shop relationships during normal model
validation. Database foreign keys protect existence, while production writes
must continue to use the audited service/API layer because PostgreSQL cannot
express every cross-table shop-equality rule as a simple check constraint.
# Primary-owner representation

`PRIMARY_OWNER` is a capability derived from `Shop.primary_owner`; stored roles
remain `OWNER` and `CASHIER`. Only the primary owner manages owners and the
subscription. Owners may manage cashiers. Cashiers have operational access but
no team, subscription, or owner-settings management.
