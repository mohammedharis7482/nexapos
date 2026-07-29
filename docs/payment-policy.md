# Payment policy

NexaPOS records tender received by the shop. It does not authorize, capture, or
settle electronic payments. `CARD` means the cashier confirmed that payment
succeeded on the shop's external bank terminal. A terminal reference is
optional and is an audit aid, not proof of authorization.

Supported allocations are CASH, CARD, or one of each for a split payment.
Allocations must equal the server-calculated sale total exactly. For cash,
amount tendered may exceed the allocation; change is calculated server-side.
Only the allocated cash amount enters drawer reconciliation.

Never enter or store PAN, CVV, PIN, expiry, magnetic-stripe data, or terminal
credentials. Stripe, Razorpay, online gateways, and recurring billing are
outside the core POS scope.
