# CSV exports

Owners can download shop-scoped Products, Inventory, Sales, and Shift CSV files
from `/api/v1/exports/`. Exports are UTF-8 with stable headers and are bounded
to 10,000 rows. Cells beginning with spreadsheet formula markers are prefixed
with an apostrophe. Cashiers are denied. Each successful export records a safe
audit event; credentials, sessions, tokens, and card-sensitive data are never
included.
