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
| Django admin | Staff/superuser only | Denied unless explicitly staff | Django admin permissions |

Model `clean()` methods protect cross-shop relationships during normal model
validation. Database foreign keys protect existence, while production writes
must continue to use the audited service/API layer because PostgreSQL cannot
express every cross-table shop-equality rule as a simple check constraint.

