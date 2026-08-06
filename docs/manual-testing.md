# Manual UI validation

Use `grocery-pilot-test.md` for release sign-off on the target barcode scanner,
receipt printer, external terminal, cash process, tablet, and mobile viewport.

For a new catalogue, create one product without a barcode using Save Product
and verify its inventory is uninitialized. Initialize it later. Create a second
product with Save & Add Stock and cancel once before retrying. Confirm only one
product exists. Add a KG product with 18.500 opening quantity, bill 0.750, and
verify the receipt and remaining balance use exact decimals. Repeat write
attempts as a cashier and confirm HTTP 403.

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

Before opening the verification link, sign in once with the correct Shop ID,
username, and password. Confirm a single Verify your email warning replaces the
generic credential error, the password is cleared, Shop ID and username remain,
and no `/auth/me/` session succeeds. Use Resend Verification Email and confirm
the API response remains generic. The new console message supersedes the old
link. After verification, return through the Shop-ID-prefilled sign-in page and
confirm the same credentials create a session and route the incomplete primary
owner to onboarding. Wrong password and wrong Shop ID must never reveal
verification state.

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
- As Primary Owner/Owner, confirm the desktop sidebar contains exactly
  Dashboard, New Bill, Products, Inventory, Sales, Reports, and Settings.
  Confirm Current Shift, Shifts, and Team are absent as primary items.
- Confirm `/shift`, `/current-shift`, `/shifts`, and `/team` preserve safe query
  strings while redirecting to their documented canonical routes. Verify
  browser back/forward does not loop.
- Confirm Sales remains active on both shift routes and Settings remains active
  on Team & Access. At mobile widths, verify role-filtered More navigation,
  accessible touch targets, focus return, and safe-area clearance.
- With no shift, verify Dashboard offers Open Shift and New Bill shows a focused
  guard without creating a draft. Open a shift, return to New Bill, and verify
  the compact shift indicator, View Shift, billing, close, and history flows.
- As Cashier, confirm only Dashboard, New Bill, Products, and Sales are primary;
  shift history is own-only, and direct Settings Team/Data URLs return to the
  permitted workspace.

## Operations

### Bulk product onboarding

1. Sign in as an Owner and open **Products → Import Products**.
2. Download the template and confirm its headers are Product Name, Category,
   Unit, SKU, Barcode, Description, Purchase Price (QAR), Selling Price (QAR),
   Tax Rate, Opening Quantity, Low Stock Threshold, and Status.
3. Import products with blank SKU/barcode, new categories, decimal opening stock,
   zero opening stock, and blank opening stock.
4. Confirm generated SKUs are visible in preview and no barcode was generated.
5. Introduce invalid prices, units, statuses, repeated SKU/barcode values, and a
   positive threshold without opening stock; confirm errors identify source rows
   and no products are created.
6. Exercise Skip, Update, and Cancel against existing products. Confirm Update
   never replaces an existing inventory quantity.
7. Confirm a valid file, review its summary/history, and search initialized
   active products in Billing.
8. Repeat at mobile width and verify tables remain horizontally usable.
9. Sign in as Cashier and confirm both the UI and direct API requests deny import.
10. Upload the downloaded template itself and confirm it validates without a
    generic error.
11. Validate a 51-row safe fixture using Piece, Bottle, Pack, Kg, and the other
    documented units; confirm Tax Exempt, Active, quoted commas, and 13-digit
    barcodes.
12. Confirm validation creates no Product, Category, InventoryBalance, or
    StockMovement. Confirm once, retry the same confirmation, and verify each
    business record exists exactly once.
13. Break one header and one unit, verify structured row/column/value/fix
    messages, filter the issue table, and download the safe error report.

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
- Confirm Team & Access shows operational member counts and a system safety
  limit, with no subscription-seat or invitation interface.
- Confirm a production build refuses a missing `NEXT_PUBLIC_API_BASE_URL`, then
  succeeds with the real HTTPS API URL and contains no localhost API target.
- Complete [production-smoke-test.md](production-smoke-test.md) after both
  services are deployed.
## Email-delivery recovery

1. Register with the console backend and find the link in the Django terminal.
2. Configure private SMTP settings and run `send_test_email`.
3. Simulate delivery failure and confirm the Shop ID remains recoverable.
4. Resend, verify the prior token is superseded, and sign in with the latest.
5. Run `cleanup_test_tenant` without `--confirm` and verify nothing changes.

## Fresh verification-exempt development flow

1. Preview and explicitly confirm `reset_development_data`.
2. Confirm only the example Plans remain.
3. Register one Shop and confirm no verification messaging or resend action.
4. Copy the Shop ID, continue to sign in, and use the registered credentials.
5. Confirm onboarding opens, can resume, and completes to Dashboard.
6. Create a cashier with `create_cashier`, then verify role restrictions.
