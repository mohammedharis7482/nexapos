# Planned features

Confirmed specs. Decisions here are settled - build to them without
re-litigating. Scope boundaries marked **deliberately out of scope** are
choices, not oversights; do not "fix" them.

Sections marked **Shipped** are built; their rules live in `business-rules.md`
and `api-contracts.md`, and only the scope boundaries still worth enforcing are
kept here. Everything else is not implemented.

## Multi-language product names - Shipped

Second-language names for **product and category records only**. App UI chrome
(buttons, labels, navigation) stays English and is out of scope.

Behaviour and API shapes: `business-rules.md` rules 22d-22g and 34,
`api-contracts.md` "Second-language names". The decisions below are recorded
because they constrain future work, not because they need re-deciding.

**Primary language is its own field, not derived from country.** `Shop.country`
is free text (`CharField(max_length=100, default="Qatar")`), so "Qatar",
"qatar", "QA" and "State of Qatar" are all valid and none maps reliably to a
language. `country` is **left exactly as it is** - not migrated, not
repurposed. A shop in Qatar may run in English; nothing infers one from the
other.

**Sale lines snapshot the second name** rather than reading it live, matching
rule 34's existing snapshot set. `image_url` reads live, but that is a
deliberate exception for a photo, not a precedent.

**The translate button is a seam, not an integration.** One module
(`frontend/src/lib/translation.ts`) with a documented request/result shape,
`isTranslationConfigured()` returning false, no provider SDK in the dependency
list and no API key setting. The button renders disabled with its reason
visible on screen - it must never look functional while inert. Wiring a
provider means implementing that one function; nothing else should learn a
provider's name.

### RTL scope boundary

Arabic and Urdu are right-to-left. RTL applies *only* to elements rendering
secondary-language text: the receipt line, search/cart/catalogue rows showing a
second name, and the secondary-name inputs. Implemented as `dir="auto"` on
those elements, which also re-evaluates as the user types.

**Deliberately out of scope:** mirroring the app layout, RTL navigation, RTL
tables and reports, bidirectional icon/chevron flipping, and a global `dir` on
`<html>`. Primary-language content, UI chrome, numbers, money and quantities
stay LTR. Tests assert exactly one directed element per surface and that the
card, grid, receipt body and `documentElement` are never directed, so widening
this fails loudly. Do not widen it without asking.

Also still out of scope: reports, CSV exports, and the inventory ledger.

## App-like feel - Shipped

Two pieces built together: PWA installability and a loading-state consistency
pass.

### PWA installability

`app/manifest.ts` (name, 192/512/maskable icons, `theme_color` #2563eb from
`--brand-600`, `display: standalone`, `start_url: /billing`), `app/icon.png`
(favicon) and `app/apple-icon.png` (180, what iOS home-screen installs use).
`themeColor` lives on the `viewport` export, not `metadata`.

**Deliberately out of scope, still: offline data caching.** No service worker,
no cache layer, no offline page, no background sync. A POS displaying stale
prices or an hours-old stock figure is worse than one that plainly says there
is no connection - a cashier who cannot tell the difference will sell against
numbers that do not exist. An installed session hits the network exactly like a
browser session.

`src/app/pwa.test.ts` enforces this: it fails if a service worker is
registered, a `sw.js`/`workbox` file appears, the Cache Storage API is used, or
a PWA/caching dependency is added. Revisit offline support only as its own
scoped work, with an explicit answer for what a cashier sees and what happens
to a bill written while disconnected.

### Loading-state consistency

The design system names four loading components and says they should resemble
final content. Fetch-gated table pages (products, sales, inventory) now use
`TableSkeleton` instead of hand-rolled bar stacks at three different heights;
metric cards and the category list use `CardSkeleton`.

Billing is the reference standard and was not touched - its split-pane and
product-grid skeletons already mirror its own final layout.

`src/app/loading-consistency.test.ts` keeps new fetch-gated table pages on the
convention.

**No new transitions were added.** The design system caps motion ("minimal,
interruptible motion", "operational speed before novelty") and `globals.css`
already collapses transitions under `prefers-reduced-motion`. Existing
`transition-colors` on interactive elements is already consistent. Anything
further would add perceptible delay to adding to cart or completing a sale,
which the spec forbids - so motion was deliberately left alone.
