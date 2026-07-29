# Production smoke test

Record release version, URLs, tester, timestamp, backup identifier, and a safe
test-shop marker. Never record credentials.

- [ ] HTTPS frontend/backend, health, and readiness succeed.
- [ ] Register a marked shop, onboard, logout, login by Shop ID, and refresh.
- [ ] Create a Cashier directly; sign in and change the temporary password.
- [ ] Create/import products and initialize stock.
- [ ] Open a shift; complete cash and external-terminal card sales.
- [ ] Preview receipt; verify one stock deduction/movement per sold line.
- [ ] Verify Sales, shift close, Dashboard, and Reports.
- [ ] Verify Cashier direct-URL/API denials.
- [ ] With a second shop, verify tenant isolation for business identifiers.
- [ ] Test login, billing, dialogs, receipt, and logout at 390px.
- [ ] Verify logout clears the session and browser back reveals no data.
- [ ] Review request IDs, paths/statuses, 4xx/5xx/429 rates, and exceptions.
- [ ] Mark retained test data or remove it only through approved workflows.
- [ ] Take and record a post-release backup.

Duplicate sales/deductions, payment mismatch, cross-shop access, session or
migration failure, or missing backup requires rollback.
