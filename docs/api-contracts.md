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

Use `http://localhost:3000` for Next.js and `http://localhost:8000` for Django.
Keeping the hostname identical allows `SameSite=Lax` cookies across ports.
Do not mix `localhost` and `127.0.0.1`, and do not proxy auth requests through
Next.js because its URL normalization can redirect Django's slash-terminated
routes.

1. Request `/api/v1/auth/csrf/` with `credentials: "include"`.
2. Read the `csrftoken` cookie.
3. Send `X-CSRFToken` on POST, PUT, PATCH, and DELETE requests.
4. Always set `credentials: "include"`.
5. Redirect to login after HTTP 401.

The typed frontend API client performs this sequence automatically for POST,
PUT, PATCH, and DELETE requests. It parses both the success and error envelopes,
maps backend field errors to forms, and converts transport failures into a
user-facing network message. Password values are never logged, and authentication
tokens or session IDs are never copied into application storage.

The frontend authentication provider requests `/auth/me/` once during
initialization. Protected routes render a deliberate loading state until that
request resolves, then either render the application shell or redirect to
`/login`. Successful login redirects to `/dashboard`; logout invalidates the
backend session before clearing frontend user state.

Navigation uses the backend role:

- OWNER: Dashboard, New Bill, Products, Inventory, Sales, Reports, Settings.
- CASHIER: Dashboard, New Bill, Products, and limited Sales navigation.

Navigation visibility is only presentation. Backend permissions remain
authoritative.

## Documentation

- `GET /api/schema/`: OpenAPI schema
- `GET /api/docs/`: Swagger UI
- `GET /api/redoc/`: ReDoc

## Shop settings

- `GET /api/v1/shop/settings/`: authenticated users read their own shop.
- `PATCH /api/v1/shop/settings/`: OWNER only; the shop always comes from the
  session and `shop`/`shop_id` inputs are rejected.

Editable fields are name, legal name, phone, email, address, city, tax
registration number, default tax rate, receipt footer, and active status.
Country, currency, and timezone remain Qatar, QAR, and `Asia/Qatar`.

## Categories

- `GET|POST /api/v1/categories/`
- `GET|PATCH /api/v1/categories/{uuid}/`

Lists accept `search`, `is_active`, `page`, and `page_size`. OWNER may see all
states and create/update records. CASHIER receives active records only and
cannot write.

## Products

- `GET|POST /api/v1/products/`
- `GET|PATCH /api/v1/products/{uuid}/`
- `GET /api/v1/products/barcode/{barcode}/`

Product lists accept `search`, `category`, `unit`, `is_active`, `ordering`,
`page`, and `page_size`. Search covers name, SKU, and barcode. Ordering accepts
`name`, `selling_price`, `created_at`, and `updated_at` (prefix with `-` for
descending). Category responses contain only `id` and `name`; product responses
do not expose a shop identifier or inventory state.

All catalogue routes require session authentication and exact trailing slashes.
No public registration, JWT token, hard-delete, inventory, or billing endpoints
exist.
