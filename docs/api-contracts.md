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
No public registration, JWT token, catalogue hard-delete, or billing endpoints
exist.

## Inventory

- `GET /api/v1/inventory/`: shop-scoped product inventory, including products
  that have not yet been initialized.
- `GET|PATCH /api/v1/inventory/{product_id}/`: inventory detail; PATCH is
  OWNER-only and changes only the low-stock threshold.
- `GET /api/v1/inventory/summary/`: real catalogue, initialized, low-stock, and
  out-of-stock counts.
- `POST /api/v1/inventory/products/{product_id}/opening-stock/`: OWNER-only
  one-time initialization.
- `POST /api/v1/inventory/products/{product_id}/adjust/`: OWNER-only manual
  movement.
- `GET /api/v1/inventory/products/{product_id}/movements/`: paginated,
  read-only audit history.
- `GET /api/v1/inventory/low-stock/`
- `GET /api/v1/inventory/out-of-stock/`

The inventory list accepts `search`, `category`, `stock_status`, `is_active`,
`page`, and `page_size`. Stock status is `NOT_INITIALIZED`, `IN_STOCK`,
`LOW_STOCK`, or `OUT_OF_STOCK`.

Opening stock accepts unsigned `quantity`, unsigned `low_stock_threshold`, and
an optional reason. Adjustment inputs contain a manual movement type, a strictly
positive unsigned quantity, optional reason, and optional reference. The server
determines the signed delta and audit values; shop, creator, before/after values,
and signed quantities cannot be supplied.

Every response follows the existing success envelope. Inventory and movement
representations omit shop identifiers. Movement creators include only UUID and
full name.

## Draft billing

- `POST|GET /api/v1/billing/drafts/`
- `GET /api/v1/billing/drafts/{sale_id}/`
- `POST /api/v1/billing/drafts/{sale_id}/items/`
- `PATCH|DELETE /api/v1/billing/drafts/{sale_id}/items/{item_id}/`
- `POST /api/v1/billing/drafts/{sale_id}/cancel/`
- `POST /api/v1/billing/drafts/{sale_id}/complete/`

Draft creation accepts only optional notes. An item addition accepts exactly one
of `product_id` or `barcode`, plus a positive quantity with up to three decimal
places. Item updates accept only quantity. Prices, tax configuration, line
totals, sale totals, shop, creator, and cancellation fields are server-owned.

OWNER sees and manages all drafts in their shop. CASHIER sees and manages only
drafts created by that cashier. Cancelled drafts and their items remain
available for audit but cannot be modified. Draft lists are newest first and
page-number paginated.

Responses contain QAR currency, safe creator data, product identity snapshots,
quantity, price/tax snapshots, calculated line amounts, and calculated sale
totals. Purchase price and internal shop identifiers are never returned.

Draft billing validates current inventory but creates no stock movement and
does not reserve stock. Completion accepts only `payments` and, for cash,
`amount_received`. Each payment has method `CASH` or `CARD`, an allocated
positive decimal amount, and an optional card-terminal reference. The allocated
sum must equal the server-calculated grand total. Cash tender must cover its
allocation; change is tender minus the cash allocation. Card is a local record
of an external terminal payment and never accepts card number, CVV, or expiry.

Completion returns the immutable completed-sale representation. The service
recalculates totals, locks the sale and product balances, revalidates stock,
records payments, deducts inventory, and creates `SALE` movements in one
transaction. A failure leaves the draft, payments, and inventory unchanged.

## Completed sales and receipts

- `GET /api/v1/sales/`
- `GET /api/v1/sales/cashiers/`
- `GET /api/v1/sales/{sale_id}/`
- `GET /api/v1/sales/{sale_id}/receipt/`

Lists contain completed sales only and support `search`, `date_from`, `date_to`,
`created_by` (OWNER only), `payment_method`, `ordering`, and pagination.
OWNER can access every completed sale in the same shop. CASHIER can access only
sales they created or completed. Receipt data comes from the completed Sale,
its snapshot lines, allocated Payments, and current receipt presentation
settings; it excludes purchase prices and sensitive payment data.

## Operational dashboard

- `GET /api/v1/dashboard/`
- Optional query: `period=today|7d`; this affects top products only.

The consolidated response contains `role`, `currency`, effective `timezone`,
`generated_at`, role-specific `summary`, five recent completed sales, limited
inventory-alert previews, five top products, seven daily trend points, and
today’s CASH/CARD allocation breakdown.

Day ranges are half-open—local midnight inclusive through the next local
midnight exclusive—using `completed_at` in the authenticated shop’s IANA
timezone. An invalid timezone falls back to `Asia/Qatar`. Draft and cancelled
sales are excluded. Trend output always includes the seven calendar days ending
today, including zero-sale days.

OWNER data is shop-wide. CASHIER financial totals, trends, top products, and
recent sales are limited to sales created or completed by that cashier.
Inventory previews include active products only. The frontend never supplies a
shop ID. Payment totals use allocated Payment amounts, so cash tender and change
cannot inflate revenue. `split_sales_total_today` identifies the total value of
sales containing both methods; cash and card allocation fields remain the
reconciling payment totals.

## Reports foundation

- `GET /api/v1/reports/` — OWNER only

Shared query parameters are `date_from`, `date_to`, `cashier`, `category`, and
`payment_method=CASH|CARD`. Dates are inclusive local calendar dates and default
to the seven days ending today in the shop timezone. The maximum accepted range
is 367 calendar days. Invalid ranges return the standard validation-error
envelope.

The consolidated response contains:

- sales totals, bill count, average bill, item quantity, tax, discount, and
  zero-filled daily totals;
- up to 50 ranked product snapshot aggregates by sales value;
- current active-product inventory counts and up to 50 inventory rows;
- CASH/CARD allocated amounts, counts, sale counts, and percentages;
- cashier sales, bill count, average bill, and item quantity.

Only completed, current-shop sales contribute to dated reports. Inventory is a
current snapshot, so date, cashier, and payment filters do not alter quantities;
the category filter does. Payment values use allocated Payment amounts and
never tendered cash. No purchase price, profit, COGS, supplier, accounting, or
export data is returned.
