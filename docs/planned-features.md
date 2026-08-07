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
