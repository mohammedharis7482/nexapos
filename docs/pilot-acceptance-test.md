# Pilot-shop acceptance test

This plan is for one authorized grocery shop using isolated pilot data. It is
not evidence that pilot testing has occurred.

Record tester, device/browser, timestamp, Pass/Fail, issue severity
(Critical/High/Medium/Low), notes, and client feedback for every scenario.

| Scenario | Expected result | Tester | Pass/Fail | Severity if failed | Notes/client feedback |
| --- | --- | --- | --- | --- | --- |
| OWNER login/logout | Generic failures; valid session opens owner shell; logout ends it |  |  | Critical |  |
| CASHIER login/logout | Cashier shell excludes owner-only actions |  |  | Critical |  |
| Add/edit product | Valid catalogue data saves; SKU/barcode conflict is clear |  |  | High |  |
| Barcode lookup | Scanner Enter returns exactly the matching active product |  |  | Critical |  |
| Initialize stock | One opening balance/movement; repeat rejected |  |  | Critical |  |
| Receive stock | Balance and audit movement increase by entered quantity |  |  | Critical |  |
| Normal cash sale | Server total paid, sale completed once, stock deducted |  |  | Critical |  |
| Cash with change | Allocated revenue equals total; change equals tender minus cash allocation |  |  | Critical |  |
| Card sale | Exact allocation; terminal reference only; no card-sensitive data |  |  | Critical |  |
| Weighted product | Three-decimal quantity and two-decimal total are correct |  |  | Critical |  |
| Insufficient stock | Completion blocked; draft, balance, movements, payments unchanged |  |  | Critical |  |
| Receipt | Shop, sale, cashier, lines, tax, payment, tender/change and footer correct |  |  | Critical |  |
| Sales history | Owner sees shop; cashier sees own; filters and dates work |  |  | High |  |
| Dashboard/reports | Reconcile with the pilot sales and inventory |  |  | High |  |
| Tablet/mobile | Billing, payment, navigation, dialogs and receipt usable |  |  | High |  |
| Temporary network failure | Draft state preserved; clear recovery message |  |  | High |  |
| Session expiration | User returns to login; no previous identity/draft leaks |  |  | Critical |  |

## Sign-off

- Shop representative:
- Deployment owner:
- Technical reviewer:
- Open Critical issues:
- Open High issues:
- Accepted limitations:
- Decision and date:

