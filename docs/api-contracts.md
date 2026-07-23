# API contracts

All API paths are versioned under `/api/v1/` except schema interfaces. JSON is
the default representation. Future list endpoints use page-number pagination
with a default size of 25, a `page_size` override, and a maximum of 100.

## Health

`GET /api/v1/health/` is public and returns HTTP 200:

```json
{"status": "ok", "service": "NexaPOS API"}
```

It is a process-level liveness response and intentionally does not claim database
health.

## Errors

Handled DRF errors use:

```json
{
  "success": false,
  "message": "Please check the entered details.",
  "errors": {}
}
```

Specific authentication and not-found messages may replace the generic message;
field and detail data remains in `errors`.

## Session authentication

Authentication uses Django server-side sessions. The browser receives an
HttpOnly session cookie; API response bodies never contain a session identifier.
Unsafe requests require the CSRF cookie value in the `X-CSRFToken` header.
Session and CSRF cookies explicitly use `SameSite=Lax`; session cookies are
HttpOnly, while CSRF cookies remain readable so Next.js can construct the
header. Production cookies are Secure.

### Initialize CSRF

`GET /api/v1/auth/csrf/` is public, initializes or refreshes the CSRF cookie,
and returns:

```json
{
  "success": true,
  "message": "CSRF cookie initialized.",
  "data": null
}
```

### Login

`POST /api/v1/auth/login/` accepts:

```json
{
  "shop_id": "uuid",
  "username": "ahmed",
  "password": "password"
}
```

It requires CSRF, scopes authentication to the selected shop, rotates the
session key, and rejects inactive users or shops with the same generic
credential response. Success returns only user ID, name, username, role, and
the shop's ID, name, currency, and timezone.

### Current user

`GET /api/v1/auth/me/` requires authentication and returns the same safe user
shape as login. Missing or expired sessions return HTTP 401.

### Change password

`POST /api/v1/auth/change-password/` requires authentication and CSRF:

```json
{
  "current_password": "...",
  "new_password": "...",
  "confirm_password": "..."
}
```

Django password validators apply. Validation errors remain field-specific, and
the valid current session is preserved after a successful change.

### Logout

`POST /api/v1/auth/logout/` requires authentication and CSRF. It deletes the
server-side authenticated session and returns a success envelope.

### Next.js request flow

Use a same-origin Next.js development proxy/rewrite from `localhost:3000` to
Django at `127.0.0.1:8000`. Those hostnames are different cookie sites, and the
proxy preserves secure `SameSite=Lax` behavior without requiring unsafe
cross-site HTTP cookie settings.

1. Request `/api/v1/auth/csrf/` with `credentials: "include"`.
2. Read the `csrftoken` cookie.
3. Send `X-CSRFToken` on POST, PUT, PATCH, and DELETE requests.
4. Always set `credentials: "include"`.
5. Redirect to login after HTTP 401.

## Documentation

- `GET /api/schema/`: OpenAPI schema
- `GET /api/docs/`: Swagger UI
- `GET /api/redoc/`: ReDoc

No public registration, business resource APIs, or JWT token endpoints exist.
