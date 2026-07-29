# Registration recovery

Registration always commits the Shop, primary owner, subscription, and audit
event atomically. When verification is required, the same transaction also
creates one hashed token and delivery is attempted after commit. Provider
failure leaves the tenant in `PENDING_VERIFICATION`, preserves the Shop ID, and
allows resend. Verification-exempt development creates no token or email.

A repeated registration with details that may already exist does not create a
second tenant. The public response gives generic possible-existing-account
guidance and does not disclose which field matched. Only after Shop ID,
username, and password are validated can login safely return
`EMAIL_NOT_VERIFIED`.

Resend always gives a generic public response. For an eligible account it
supersedes prior unused tokens, creates one new hashed and expiring token, and
attempts delivery.
