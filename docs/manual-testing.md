# Manual UI validation

## SaaS acceptance

Register a synthetic shop, capture the console verification email, verify,
sign in, resume and complete onboarding, confirm trial/limits, invite and accept
a cashier, and verify cashier route restrictions. Resend and revoke separate
invitations. Deactivate/reactivate the cashier and confirm login behavior.

For registration specifically, inspect Network and confirm one deliberate
click or Enter press creates one `POST /api/v1/saas/register/` request and a
`201` response. Double-click while the request is delayed and confirm it still
creates one POST. After an invalid `400`, correct the fields and retry; the
success panel must replace all red alerts and invalid-field state. Simulate a
network failure, confirm values remain available, then retry explicitly.
Success removes the password fields and Create Shop action and provides
Go to Sign In. Confirm the success panel shows the shop name and full Shop ID,
Copy Shop ID writes the exact UUID, and the sign-in link contains only the
URL-encoded `shop_id`. No password or verification token may appear in that
URL.

Open the console verification email and confirm the same shop name, Shop ID,
and username appear without a password. After verification, confirm the
success page repeats the same Shop ID and its sign-in action prefills login.
Test a malformed `shop_id` query and confirm a field error appears without
submitting. A valid query takes precedence over a remembered value but remains
unpersisted until a successful login with Remember Shop ID selected. After
login, confirm Account and Shop Settings show the immutable ID and copy action.

Development uses Django's console email backend. Find the verification URL in
the terminal running `manage.py runserver`; do not expect external email
delivery. To verify safely that a synthetic registration exists, use
placeholders and return counts rather than record contents:

```bash
cd backend
.venv/bin/python manage.py shell \
  --settings=config.settings.development \
  -c "from apps.accounts.models import User; from apps.shops.models import Shop; email='<TEST_EMAIL>'; print({'users': User.objects.filter(email__iexact=email).count(), 'shops': Shop.objects.filter(email__iexact=email).count()})"
```

Never paste a real password or verification token into this check. Do not
delete a tenant automatically; inspect its relationships and use Django Admin
for an explicitly approved development-only cleanup.

Request password recovery for known and unknown emails and confirm identical
responses. Use the known account’s one-time link, verify the old password and
old sessions fail, and sign in with the new password.

Through Django Admin, move a test subscription through TRIAL, ACTIVE, PAST_DUE,
SUSPENDED, and back to ACTIVE. Confirm suspension preserves safe owner reads,
blocks POS mutations, and does not delete data.

Repeat registration, onboarding, invitation acceptance, Team, Account, and
Subscription pages at 360, 390, 430, 768, 1024, and 1440 pixels. Do not use a
real shop email, password, or production database.

Use real development records; do not create fake analytics or screenshot-only
data. Validate at 360, 390, 430, 768, 1024, 1280, and 1440 CSS pixels.

## Authentication and shell

- Submit empty, invalid, unavailable-server, and valid login states by keyboard.
- Verify remembered Shop ID, password visibility, session restoration, and
  logout.
- Confirm OWNER and CASHIER navigation differs correctly.
- Check active navigation, More sheet, Change Password, Escape, focus return,
  and mobile safe-area clearance.

## Operations

- Dashboard OWNER: verify shop-wide sales, bills, average bill, items sold,
  cash/card allocation, cashier context in Recent Sales, all three inventory
  alert states, top products, action links, and refresh.
- Dashboard CASHIER: verify personal metrics and own recent sales; confirm
  payment summary, inventory management, top products, Add Product, and Update
  Stock are absent.
- Dashboard states: verify zero sales, no payments, no recent sales, healthy
  inventory, empty top products, initial skeleton, complete failure, failed
  background refresh, and retry.
- Complete one real sale and confirm metrics, chart, payments, recent sales,
  inventory attention, and top products update after refresh.
- Compare Dashboard Recent Sales with `/sales`: Dashboard rows must use the
  compact `NXP-######` preview, concise local time, owner-only cashier metadata,
  payment, total, and whole-row detail link; `/sales` must retain its full sale
  number, table columns, filters, pagination, and View action.
- Keyboard-focus each dashboard transaction row and open it with Enter. Confirm
  the full reference/timestamp remain available through its accessible label
  and title.
- At 360, 390, 430, 768, 1024, 1280, and 1440px verify the one-column narrow
  phone/two-column 430px metric grid, chart labels/tooltips, table-to-card transition, readable QAR
  values, bottom-navigation clearance, and absence of horizontal overflow.
- Products/categories: search, filters, connected result footer, desktop table,
  mobile cards, grouped forms, validation, saving, and inactive states. Confirm
  select labels never sit beneath the chevron and long SKU/barcode values wrap.
- Inventory: all four statuses, detail, opening stock, adjustment direction,
  expected balance, errors, and movement history. Confirm threshold and ledger
  quantities show their unit, long references wrap, and movement pagination
  stays usable at 360px.
- Billing: initial search focus, exact barcode Enter, repeated item, weighted
  quantity, inline removal confirmation, draft cancellation confirmation,
  empty cart, payment modes, failure preservation, and success actions.
- Sales: filters, connected result/pagination surfaces, desktop rows, mobile
  cards, full wrapping sale numbers, read-only detail, receipt route, and
  not-found/error handling.
- Reports: all tabs, shared filters, empty range, refresh, links, and chart
  overflow.
- Settings: OWNER editing, CASHIER read-only state, grouped fields, percentage
  affix, disabled clean save state, unsaved indicator, validation, success, and
  backend errors.

## Accessibility and presentation

- Traverse every interactive flow with Tab, Shift+Tab, Enter, Space, and Escape.
- Confirm focus is always visible and no status depends on colour alone.
- At every viewport, check for horizontal page overflow, clipped dialogs,
  bottom-navigation overlap, tiny targets, and unreadable tables.
- Enable reduced motion and confirm no workflow depends on animation.
- Inspect browser console for hydration, key, or runtime warnings.
- Print a receipt preview at 80mm and A4; confirm only receipt content prints,
  item names wrap, totals align, and nothing clips.

## Interaction overlays

- Open every category, product, opening-stock, adjustment, payment, password,
  and confirmation dialog at each target viewport. Confirm header/footer
  visibility, internal scrolling, focus return, Escape behavior, and safe
  action ordering.
- During a deliberately delayed mutation, confirm Escape, backdrop click, and
  the close button cannot dismiss the critical dialog; Cancel and other
  non-critical flows remain dismissible.
- In the user dropdown, test outside click, Escape, Arrow Up, Arrow Down, and
  action-close behavior. Confirm the menu stays inside the viewport.
- Test native selects in Chrome and Safari. Confirm one arrow, reserved text
  space, hover/focus/invalid/disabled states, keyboard selection, and the
  platform-native mobile picker.
- Sales and Reports dates must align with other controls. Confirm end-before-
  start cannot be applied, presets remain selected accurately, and Reset
  restores the default range.
- Confirm controlled searches expose Clear search and active product,
  inventory, and sales filters expose a complete clear action.
- Render success and error toasts above mobile navigation. Confirm tone icon,
  announcement, long-text wrapping, close action, and provider-level duplicate
  suppression.

## Production-readiness checks

- Over deployed HTTPS, inspect Secure/HttpOnly/SameSite cookie attributes,
  CSRF mutation behavior, explicit origins, redirect handling, and proxy scheme.
- Deactivate a disposable pilot shop during an active session and confirm the
  next API request returns to login without exposing the previous active draft.
- Exercise edge and application login limits using synthetic accounts; confirm
  generic HTTP 429 feedback and that normal tills are not blocked.
- Verify `/health/` remains live when appropriate and `/readiness/` returns 503
  during a controlled database outage without diagnostic details.
- Force an unexpected route render error in staging and confirm the safe retry
  boundary contains no stack trace.
- Complete the scenarios and sign-off fields in
  [pilot-acceptance-test.md](pilot-acceptance-test.md).
