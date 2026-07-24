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

- Dashboard: role-specific metrics, zero data, refresh, links, alerts, and chart
  resizing.
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
