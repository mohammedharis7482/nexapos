# Navigation architecture

## Primary navigation

Primary Owner and Owner sessions see Dashboard, New Bill, Products, Inventory,
Sales, Reports, and Settings. Cashiers see Dashboard, New Bill, Products, and
Sales. Product and sales APIs retain their existing role-scoped read behavior;
Inventory, Reports, Team & Access, Data Management, and sensitive Settings
remain protected by route guards and backend permissions.

Mobile navigation presents Dashboard, New Bill, Products, and the most useful
role-permitted fourth destination, plus a More sheet. The sheet contains the
remaining permitted modules and a contextual Current Shift shortcut. Account
and logout remain available from the profile controls.

## Parent modules

Sales uses:

- `/sales` — Transactions (cashier copy is personal and backend-scoped)
- `/sales/shifts` — shift history, shop-wide for owners and own-only for cashiers
- `/sales/shifts/current` — open/view/close the signed-in user’s current shift

Settings uses:

- `/settings` — Shop Profile, including existing POS and receipt preferences
- `/settings/team` — Team & Access
- `/settings/data` — links to the implemented product import and CSV exports

Products retains Categories, Import Products, and Add Product as responsive
page actions. Inventory and Reports retain their implemented inner views;
unimplemented tabs were not added.

## Contextual shift access

Dashboard renders a compact Current Shift card with loading, unavailable, no
active shift, and active shift states. New Bill checks the same lightweight
current-shift API exactly during workspace initialization. Without a shift it
shows an Open Shift panel and does not create a draft. With a shift it shows a
small header indicator. Sale completion remains enforced by Django.

## Active routes and compatibility

Primary active state matches either the exact route or a `/` path boundary.
Therefore Sales stays active throughout `/sales/*`, Settings throughout
`/settings/*`, and Products throughout `/products/*`; unrelated prefixes
cannot match accidentally.

Temporary Next.js redirects preserve bookmarks and query strings:

- `/shift` and `/current-shift` → `/sales/shifts/current`
- `/shifts` → `/sales/shifts`
- `/team` → `/settings/team`

The destinations remain behind the existing authentication, lifecycle, and
role guards. There are no duplicate runtime page implementations.
