# Manual UI validation

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
- Products/categories: search, filters, desktop table, mobile cards, grouped
  forms, validation, saving, and inactive states.
- Inventory: all four statuses, detail, opening stock, adjustment direction,
  expected balance, errors, and movement history.
- Billing: initial search focus, exact barcode Enter, repeated item, weighted
  quantity, inline removal confirmation, draft cancellation confirmation,
  empty cart, payment modes, failure preservation, and success actions.
- Sales: filters, pagination, desktop rows, mobile cards, read-only detail,
  receipt route, and not-found/error handling.
- Reports: all tabs, shared filters, empty range, refresh, links, and chart
  overflow.
- Settings: OWNER editing, CASHIER read-only state, grouped fields, validation,
  success, and backend errors.

## Accessibility and presentation

- Traverse every interactive flow with Tab, Shift+Tab, Enter, Space, and Escape.
- Confirm focus is always visible and no status depends on colour alone.
- At every viewport, check for horizontal page overflow, clipped dialogs,
  bottom-navigation overlap, tiny targets, and unreadable tables.
- Enable reduced motion and confirm no workflow depends on animation.
- Inspect browser console for hydration, key, or runtime warnings.
- Print a receipt preview at 80mm and A4; confirm only receipt content prints,
  item names wrap, totals align, and nothing clips.
