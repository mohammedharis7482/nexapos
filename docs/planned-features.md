# Planned features

Confirmed specs for features that are **not built yet**. Decisions here are
settled - build to them without re-litigating. Anything genuinely undecided is
called out as an open question; ask rather than guess.

Shipped features are documented in `business-rules.md` and `api-contracts.md`.
Nothing in this file is implemented.

## Multi-language product names

Second-language names for **product and category records only**. App UI chrome
(buttons, labels, navigation) stays English and is out of scope.

### Languages

- **Primary**: derived from the shop's country.
- **Secondary**: one per shop, chosen by the owner from English, Arabic,
  Malayalam, Hindi, Urdu.

One secondary language per shop, not per product and not a list.

> **Open question - resolve before building.** `Shop.country` is a free-text
> `CharField(max_length=100, default="Qatar")`, not a country code. A language
> cannot be reliably derived from free text ("Qatar", "qatar", "QA", "State of
> Qatar" all differ). Either migrate `country` to a code with a country→language
> map, or make primary language an explicit shop field. Confirm which before
> writing the migration.

### Data

Second name fields on `Product` and `ProductCategory`, blank-allowed. The
secondary language belongs on `Shop`, since it is one setting for the whole
shop rather than per record.

A product with no second name must behave exactly as it does today - every
surface falls back to the primary name. Follow the `Product.image` precedent:
optional field, no behaviour change for records that never opt in.

### Entry and the translate button

**Manual entry first.** The owner types both names in the product form. Build
the schema and both input fields now.

Ship a **translate button** next to the second-name field, wired to a seam
rather than a live API - a single call site that a translation provider can be
dropped into later. No provider is integrated, and no translation API is called
while the app is unhosted, so this adds no hosting or per-call cost. The button
either stays disabled with a clear reason, or is hidden behind a settings flag
that is off by default - it must never appear functional and silently fail.

Keep the seam narrow: one module with a documented input/output shape, no
provider SDK in the dependency list, no API key in settings until a provider is
actually chosen.

### Where the second name surfaces

1. **Billing search** - the search must match **either** language. Today
   `filter_inventory_products` matches `name`, `sku`, `barcode`
   (`apps/inventory/selectors.py`); the second-name field joins that `Q` chain.
   `products/selectors.py` has the equivalent chain for the catalogue.
2. **Receipts** - an optional additional line under the product name
   (`frontend/src/components/sales/receipt.tsx`). Optional per shop; a shop
   with no second names must see an unchanged receipt.

Not in scope: reports, CSV exports, or the inventory ledger. Add them only if
asked.

### Notes for whoever builds this

- Search across two columns needs an index plan; the existing per-field indexes
  on `Product` are the precedent.
- Sale items snapshot `product_name` at sale time. Decide explicitly whether the
  second name is also snapshotted (consistent with the existing snapshot rule)
  or read live (consistent with `image_url`). Both are defensible - pick one and
  write it into `business-rules.md`.
- Arabic and Urdu are right-to-left. Receipts and search results need to render
  RTL text correctly; the app does not currently handle any RTL content.

## App-like feel

**Build last**, after the feature set is stable. Two separate pieces of work
that ship together.

### PWA installability

- Web app manifest, icons, and a service worker. Neither exists today - there is
  no manifest and no service worker anywhere in `frontend/`.
- "Add to Home Screen" on Android and iOS.
- Launches standalone, without browser chrome.
- `next.config.ts` already sets security headers and Turbopack root; the
  manifest and service worker registration slot in alongside.

Offline behaviour is **not** specified here. A POS that appears to work offline
while silently failing to reach the API is worse than one that plainly reports
the network is down. Decide the offline story explicitly before adding a caching
service worker - do not let a default caching strategy make that decision.

### Interaction polish

- Consistent transitions across the app.
- Consistent loading states - one skeleton/spinner convention rather than the
  per-page variation that exists now.

Both must follow `design-system-v2.md`, which caps motion: "minimal,
interruptible motion" and "operational speed before novelty". Polish must not
slow a cashier down, and billing-screen keyboard navigation must stay
regression-tested.
