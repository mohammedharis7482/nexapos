# Subscription foundation

Plan stores simple user/product limits and report entitlements. ShopSubscription
is the one current subscription per Shop and is the source for trial dates,
period dates, grace dates, and subscription status.

`seed_plans` creates missing STARTER, GROWTH, and PRO examples without
overwriting existing records. Their zero prices are placeholders, not final
commercial offers. The frontend shows “Contact support”; it never displays a
successful payment or collects card details.

Active users and active products count toward limits. Deactivated users and
inactive products do not. Enforcement occurs in service code before user
invitation/acceptance/reactivation and product creation/reactivation.

Gateway customer identifiers, checkout, recurring charging, metered billing,
invoices, and webhook processing are deferred.
