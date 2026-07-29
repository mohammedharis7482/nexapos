# Cashier shifts

Every owner or cashier must open their own shift before completing a sale.
Opening cash defaults to QAR 0.00, is non-negative, and represents the physical
drawer float. PostgreSQL permits only one open shift per shop/user.

Expected closing cash is calculated only by the server:

`opening cash + completed CASH payment allocations`

Card allocations, cash tendered above the allocation, change, held or cancelled
bills, and failed completion attempts do not increase expected cash. On close,
variance is `counted cash - expected cash`. Closing is atomic and closed shifts
cannot receive further sales. Historical sales created before this feature may
have no shift.

Owners can inspect all shop shifts. Cashiers can open, close, and inspect only
their own shifts.
