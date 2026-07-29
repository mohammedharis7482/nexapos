# Receipts and reprints

Receipts render immutable sale-item and payment records: shop identity, sale
number and time, cashier, product name/SKU/unit snapshots, quantities, prices,
tax, totals, allocations, cash tender/change, optional terminal reference, and
footer. Reprinting never modifies the sale, payment, inventory, or shift. It
creates a safe `RECEIPT_REPRINTED` audit event. Owners can reprint shop sales;
cashiers can reprint only sales visible under their existing sales policy.
