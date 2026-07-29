# Email delivery

NexaPOS uses one templated email service for verification, password reset,
invitations, welcome messages, and delivery tests. It returns only:

- `DEVELOPMENT_CONSOLE` when Django writes the message to the server terminal;
- `EMAIL_SENT` when the configured backend accepts one message;
- `EMAIL_DELIVERY_FAILED` when delivery raises or accepts no message.

Development defaults to Django's console backend. To test a real inbox, set
private local environment values for the SMTP backend, host, port, username,
password, TLS or SSL, sender, and timeout. TLS and SSL cannot both be enabled.
The configuration is provider-neutral.

Production refuses the console backend. Logs contain event type, internal
user/shop IDs, backend name, status, and exception class; they never contain
message bodies, action URLs, tokens, passwords, or SMTP credentials.

```bash
python manage.py send_test_email --to test@example.com \
  --settings=config.settings.development
```

This development-only probe contains no action token.
