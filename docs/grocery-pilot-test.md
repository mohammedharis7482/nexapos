# Grocery-shop pilot test

Record Actual result, Pass/Fail, Severity, Notes, Tester, and Sign-off for every
case below. Stop deployment for any unresolved Critical failure.

| Area | Test and expected result | Actual | Pass/Fail | Severity | Notes | Tester | Sign-off |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Account | Register, onboard, create cashier, and replace temporary password |  |  | Critical |  |  |  |
| Catalogue | Create category, regular and weighted products; scan barcode; inactive product is blocked |  |  | High |  |  |  |
| Inventory | Opening stock, increase, damage, low-stock warning, insufficient-stock rejection |  |  | Critical |  |  |  |
| Shift | Open with float; duplicate open is rejected |  |  | Critical |  |  |  |
| Cash | Complete cash sale; allocation and server change are correct |  |  | Critical |  |  |  |
| Card | Confirm terminal success externally; record optional reference; no card details |  |  | Critical |  |  |  |
| Split | Cash plus card equals total; drawer includes only cash allocation |  |  | Critical |  |  |  |
| Held bill | Hold without stock deduction, resume with revalidation, cancel another held bill |  |  | High |  |  |  |
| Receipt | View, print and reprint; reprint causes no inventory/payment mutation |  |  | High |  |  |  |
| Shift close | Count drawer; expected cash and positive/negative variance reconcile |  |  | Critical |  |  |  |
| Review | Owner reviews sales, dashboard, reports, shifts and four exports |  |  | High |  |  |  |
| Security | Cashier cannot inspect other shifts or use exports |  |  | Critical |  |  |  |
| Failure | Double-click payment creates one sale/deduction |  |  | Critical |  |  |  |
| Failure | Network interruption permits safe retry without duplicate completion |  |  | Critical |  |  |  |
| Failure | Expired session requires login without losing server-held bill |  |  | High |  |  |  |
| Failure | Terminal fails before confirmation; NexaPOS records no card payment |  |  | Critical |  |  |  |
| Responsive | Billing, shift close, receipt and exports are usable on supported mobile/tablet widths |  |  | High |  |  |  |
