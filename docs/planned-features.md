# Planned features

Confirmed specs for features that are **not built yet**. Decisions here are
settled - build to them without re-litigating. Scope boundaries marked
**deliberately out of scope** are choices, not oversights; do not "fix" them.

Shipped features are documented in `business-rules.md` and `api-contracts.md`.
Nothing in this file is implemented.

## Multi-language product names

Second-language names for **product and category records only**. App UI chrome
(buttons, labels, navigation) stays English and is out of scope.

### Languages

Both languages are explicit `Shop` fields:

- **`Shop.primary_language`** - a new field, defaulting to English.
- **`Shop.secondary_language`** - a new field, owner-selected from English,
  Arabic, Malayalam, Hindi, Urdu.

One secondary language per shop, not per product and not a list.

**Decided: primary language is its own field, not derived from country.**
`Shop.country` is free text (`CharField(max_length=100, default="Qatar")`), so
"Qatar", "qatar", "QA" and "State of Qatar" are all valid and none maps
reliably to a language. `country` is **left exactly as it is** - not migrated,
not repurposed, not made an enum. The two are independent settings; a shop in
Qatar may run in English, and nothing should infer one from the other.

Share one language choice list between both fields (a single `TextChoices`),
so the supported set is defined once.

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

### Sale items snapshot the second name

**Decided: snapshot, not a live lookup.** `SaleItem` gains a second-name column
alongside the existing `product_name`, written at the moment the line is added.

This follows the established snapshot rule (rule 34 in `business-rules.md`):
name, SKU, barcode, unit, price and tax are frozen on the line so later
catalogue edits never rewrite a past sale. The second name is a name, so it
behaves like one. `image_url` reads live, but that is a deliberate exception for
a photo, not the precedent to copy here.

A reprinted receipt therefore shows the second name as it was sold, even if the
product was later renamed or the shop changed its secondary language. Update
rule 34 to name this column when the work is done.

### RTL is scoped to secondary-language text only

Arabic and Urdu are right-to-left. The app renders no RTL content today.

**Decided: no app-wide RTL rebuild.** RTL support applies *only* to the
surfaces that render secondary-language text:

- the secondary-name line on receipts
- search results and cart/catalogue rows displaying a secondary name
- the secondary-name input in the product and category forms

Achieved per element - `dir="rtl"` (or `dir="auto"`) on the element holding that
text, driven by the shop's secondary language.

**Deliberately out of scope:** mirroring the app layout, RTL navigation, RTL
tables and reports, bidirectional icon/chevron flipping, and a global `dir` on
`<html>`. Primary-language content, UI chrome, numbers, money and quantities all
stay LTR. This boundary exists so the feature stays a product-name feature and
does not become a UI rewrite - do not widen it without asking.

### Other notes

- Search across two columns needs an index plan; the existing per-field indexes
  on `Product` are the precedent.

## App-like feel

**Build last**, after the feature set is stable. Two separate pieces of work
that ship together.

### PWA installability

Installability only. Nothing exists today - there is no manifest and no service
worker anywhere in `frontend/`.

In scope:

- Web app manifest with name, icons, theme colour, and `display: standalone`.
- Home-screen icon set for Android and iOS.
- "Add to Home Screen" works on both.
- Launches standalone, without browser chrome.

`next.config.ts` already sets security headers and the Turbopack root; the
manifest slots in alongside.

**Deliberately out of scope in this pass: offline data caching.** No service
worker caching strategy, no cached API responses, no offline page, no background
sync. A POS displaying stale prices or a stock figure that is quietly hours old
is worse than one that plainly says there is no connection - a cashier who
cannot tell the difference will sell against numbers that do not exist.

This is a decision, not a gap. If a service worker is added at all (for
installability on browsers that require one), it must not cache API responses.
Revisit offline support only as its own scoped piece of work, with an explicit
answer for what a cashier sees and what happens to a bill written while
disconnected.

### Interaction polish

- Consistent transitions across the app.
- Consistent loading states - one skeleton/spinner convention rather than the
  per-page variation that exists now.

Both must follow `design-system-v2.md`, which caps motion: "minimal,
interruptible motion" and "operational speed before novelty". Polish must not
slow a cashier down, and billing-screen keyboard navigation must stay
regression-tested.
