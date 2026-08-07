# API contracts

All API paths are versioned under `/api/v1/` except schema interfaces. JSON
throughout. List endpoints use page-number pagination (`common/pagination.py`):
default size 25, `page_size` override, maximum 100.

## Health

`GET /api/v1/health/` is public and returns HTTP 200:

```json
{"status": "ok", "service": "NexaPOS API"}
```

It is a process-level liveness response and intentionally does not claim database
health.

`GET /api/v1/readiness/` is also public. It performs a low-cost database
`SELECT 1` and returns either HTTP 200 with `status: "ready"` or HTTP 503 with
`status: "unavailable"`. It never returns database configuration or exception
details.

## Errors

Handled errors use one envelope (`common/exceptions.py`):

```json
{
  "success": false,
  "message": "Requested quantity exceeds available stock.",
  "errors": {"quantity": "Requested quantity exceeds available stock."}
}
```

`message` resolution, in priority order:

1. Coded errors (`{"code": ..., "detail": ...}`) use `detail`, and the response
   gains a top-level `code`.
2. A validation error with **exactly one key mapping to plain text** is
   promoted into `message` - this is how domain rejections ("Stock changed
   before payment.", "This user already has an open shift.") reach the user.
3. Everything else keeps `"Please check the entered details."` This is
   deliberate for multi-field form errors: the client shows a summary banner
   plus per-field messages from `errors`.

Single-key errors whose value is structured (for example `import_errors`, a
list of objects) are never stringified into `message`.

Unhandled exceptions return HTTP 500 with
`"NexaPOS could not complete the request."` and empty `errors`. Every response
carries a non-sensitive `X-Request-ID` for log correlation.

## Session authentication

Django server-side sessions. The browser receives an HttpOnly session cookie;
response bodies never contain a session identifier.

`CSRF_USE_SESSIONS = True`: the CSRF secret lives in the session, **not** in a
separate readable cookie. Clients obtain the token from the response body of
`GET /api/v1/auth/csrf/` and send it as `X-CSRFToken` on every unsafe request.
This is required because the frontend and API are served from different
registrable domains, where a browser's third-party cookie policy can silently
drop a cross-site cookie even with `SameSite=None; Secure` - with no way for JS
to detect it. Nothing reads `document.cookie`.

Cookies use `SameSite=Lax` by default; production adds `Secure`. Local
development must use `localhost` for both apps (not `127.0.0.1`) - they are
different cookie sites.

### Initialize CSRF

`GET /api/v1/auth/csrf/` is public and returns the token in the body:

```json
{
  "success": true,
  "message": "CSRF token issued.",
  "data": {"csrf_token": "..."}
}
```

The frontend caches this in module memory (`lib/csrf.ts`), fetches it once on
demand, and refetches only after a `403 CSRF Failed` retry.

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

Login is throttled by source IP and by a hashed IP/shop/username context.
Exceeded limits return HTTP 429 without identifying whether an account exists.

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

## SaaS account APIs

- `POST /api/v1/saas/register/`: public atomic shop, primary owner, trial, and
  verification creation. Returns HTTP `201`:

  ```json
  {
    "success": true,
    "message": "Shop created. Verify the owner email before signing in.",
    "data": {
      "shop": {"id": "uuid", "name": "Example Grocery"},
      "owner": {"username": "owner"},
      "verification_required": true,
      "owner_email": "owner@example.test",
      "registration_status": "PENDING_VERIFICATION",
      "email_delivery": "EMAIL_SENT",
      "next_step": "VERIFY_EMAIL"
    }
  }
  ```

  Clients read these fields rather than inferring from build environment:

  | `REQUIRE_EMAIL_VERIFICATION` | `registration_status` | `next_step` |
  | --- | --- | --- |
  | `True` | `PENDING_VERIFICATION` | `VERIFY_EMAIL` |
  | `False` | `ONBOARDING` | `SIGN_IN` |

  `email_delivery` is `EMAIL_SENT`, `DEVELOPMENT_CONSOLE`,
  `EMAIL_DELIVERY_FAILED`, or `NOT_REQUIRED`. Delivery failure still returns
  `201` - the tenant was durably created and stays recoverable.

  A possible duplicate returns generic `ACCOUNT_MAY_EXIST` guidance and creates
  no additional records. Resend returns the same acknowledgement for eligible
  and unknown contexts.

  The response never contains passwords, raw tokens, session identifiers, or
  subscription internals. Clients cannot select role or subscription state.
- `POST /api/v1/auth/email-verification/resend/` and
  `POST /api/v1/auth/email-verification/verify/`: generic resend and one-time
  hashed-token verification. Successful verification returns only the verified
  shop's `id` and `name` so the login handoff does not require another lookup.
- `POST /api/v1/auth/password-reset/request/` and
  `POST /api/v1/auth/password-reset/confirm/`: enumeration-safe recovery and
  one-time reset.
- `GET|POST /api/v1/invitations/accept/`: safe invitation context and atomic
  acceptance.
- `GET|POST /api/v1/team/users/`: owner-only, current-shop listing and direct
  staff creation. Direct creation accepts `full_name`, `username`, optional
  `email`, `role`, `temporary_password`, and confirmation. Password fields are
  write-only and absent from responses.
- `GET|PATCH /api/v1/team/users/{user_id}/`: shop-scoped detail/profile update.
- `POST /api/v1/team/users/{user_id}/{activate|deactivate|change-role}/`:
  policy-checked lifecycle actions. Role changes and deactivation invalidate
  affected sessions.
- `POST /api/v1/team/users/{user_id}/reset-password/`: accepts a temporary
  password and confirmation, invalidates sessions, and marks password change
  required. It never returns credentials.
- Legacy `/api/v1/users/` routes and the existing invitation routes remain
  available for compatibility.
- `GET|PATCH /api/v1/saas/onboarding/` and
  `POST /api/v1/saas/onboarding/complete/`: primary-owner onboarding progress.
- `GET /api/v1/saas/subscription/` and `GET /api/v1/saas/plans/`: OWNER-only
  current subscription, real plan records, and authoritative usage.

Tokens are accepted only as write-only inputs or URL query input for the public
invitation preview. Token hashes are never serialized.

Shop ID is a public tenant identifier required alongside username and password
at login. Knowing it grants no access; authentication and shop-scoped
authorization remain mandatory.

### Shifts and operational completion

- `GET /api/v1/shifts/current/`
- `POST /api/v1/shifts/open/`
- `POST /api/v1/shifts/{id}/close/`
- `GET /api/v1/shifts/` and `GET /api/v1/shifts/{id}/`
- `POST /api/v1/billing/drafts/{id}/hold/`
- `POST /api/v1/billing/drafts/{id}/resume/`
- `POST /api/v1/sales/{id}/receipt/reprint/`
- Owner-only `/api/v1/exports/{products|inventory|sales|shifts}.csv`

Expected cash and variance are response-only calculated fields. Sale completion
requires the completing user's open shift.

### Manual product entry

`POST /api/v1/products/` is owner-only and derives the shop from the session.
SKU is required; barcode and category are optional. A successful response
contains the single created product and does not initialize inventory.
`POST /api/v1/inventory/products/{product_id}/opening-stock/` is the separate,
one-time owner action used by both later inventory setup and the frontend
Save & Add Stock handoff.

### Multi-pricing products

`pricing_mode` is `STANDARD` (default) or `MULTI`. A MULTI product carries a
writable nested `packets` array, replaced wholesale on each write. `size` is in
the product's own `unit` - a 250 g packet of a KG product is `"0.250"`.

Two packet shapes exist. Product responses use the full one; billing and
inventory responses use a trimmed one, and omit inactive packets entirely:

| Endpoint | Packet fields |
| --- | --- |
| `/api/v1/products/` | `id`, `size`, `price`, `display_order`, `is_active` |
| `/api/v1/inventory/` | `id`, `size`, `price` (active only) |

Writes accept `size` and `price`; `display_order` defaults to array position.
At least one packet is required for MULTI, sizes must be unique, and packets on
a STANDARD product are rejected - all as `errors.packets`. Switching a product
back to STANDARD clears its packet offer.

`POST /api/v1/billing/drafts/{id}/items/` accepts optional `pricing_mode`
(`STANDARD`, `PACKET`, `LOOSE`) and `packet_id`. Both are omitted for standard
products, so existing callers and barcode scans are unaffected. A MULTI product
requires an explicit mode; `packet_id` is required for - and only valid with -
`PACKET`.

Sale items expose `pricing_mode`, `packet_size` (null unless PACKET),
`quantity` (packets for a PACKET line, units otherwise) and `stock_quantity`
(always the product's own unit). Billing list responses carry `pricing_mode`
and the product's active `packets`; withdrawn packets are withheld.

### First login and verification

Public registration creates an active owner record with
`email_verified_at=null` and a shop in `PENDING_VERIFICATION`. Correct Shop ID,
username, and password submitted before verification return HTTP `403`:

```json
{
  "success": false,
  "message": "Verify your email before signing in.",
  "code": "EMAIL_NOT_VERIFIED",
  "errors": {
    "can_resend_verification": true
  }
}
```

This code is emitted only after all three credentials have been validated.
Unknown shops/users and wrong passwords return HTTP `401` with
`INVALID_CREDENTIALS` and the same generic message. No session is created for
either response.

`POST /api/v1/auth/email-verification/resend/` accepts either an email or the
known `shop_id` plus `username`. Its response is always generic. Eligible
unverified users receive a new message and previous active tokens are
superseded; verified or unknown accounts reveal nothing.

### Logout

`POST /api/v1/auth/logout/` requires authentication and CSRF. It deletes the
server-side authenticated session and returns a success envelope.

### Next.js request flow

Use `http://localhost:3000` and `http://localhost:8000`. Do not mix `localhost`
with `127.0.0.1`, and do not proxy auth requests through Next.js - its URL
normalization redirects Django's slash-terminated routes.

`lib/api-client.ts` handles this automatically:

1. On the first unsafe request, GET `/api/v1/auth/csrf/` and cache
   `data.csrf_token` in module memory.
2. Send it as `X-CSRFToken` on POST/PUT/PATCH/DELETE, always with
   `credentials: "include"`.
3. On `403 CSRF Failed`, clear the cached token, refetch once, and retry once.
4. HTTP 401 dispatches an unauthorized event - clear user state, redirect to
   login. HTTP 403 is a permission error and does not invalidate the session.

Requests have a configurable timeout; unsafe mutations are not auto-retried
except for the single CSRF retry above. Tokens and session IDs are never
written to browser storage, and passwords are never logged.

The auth provider requests `/auth/me/` once on init (guarded against React
Strict Mode double-invoke). Protected routes hold a loading state until it
resolves, then render the shell or redirect to `/login`.

Role-based navigation visibility is presentation only - backend permissions
remain authoritative. See `docs/navigation.md`.

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

### Bulk product import

- `GET /api/v1/products/import-template/` downloads the canonical UTF-8 CSV.
- `POST /api/v1/products/imports/` accepts multipart field `file`, validates the
  CSV, and creates a shop-scoped preview without changing products.
- `GET /api/v1/products/imports/` returns paginated import history.
- `GET /api/v1/products/imports/{import_id}/` returns an import summary and
  paginated row preview. `severity`, `column`, and `search` filter preview
  issues server-side.
- `POST /api/v1/products/imports/{import_id}/confirm/` accepts
  `duplicate_strategy` as `SKIP`, `UPDATE`, or `CANCEL` plus
  `confirmed=true`.
- `GET /api/v1/products/imports/{import_id}/errors/` downloads a formula-safe
  UTF-8 CSV error report.

All endpoints require Owner access. Confirm is rejected if any validation row
has errors. See [product-import.md](product-import.md) for column and transaction
rules.

The upload response exposes `validation_id`, filename, total/valid/invalid and
warning rows, categories to create, duplicate counts, `can_import`, expiry,
history metadata, and a paginated row preview. Each issue contains row number,
column, original value, stable error code, human message, and suggested fix.
Header failures use the same public API error envelope with structured
`errors.import_errors`; tracebacks and internal paths are never returned.

- `GET|POST /api/v1/products/`
- `GET|PATCH /api/v1/products/{uuid}/`
- `GET /api/v1/products/barcode/{barcode}/`

Product lists accept `search`, `category`, `unit`, `is_active`, `ordering`,
`page`, and `page_size`. Search covers name, SKU, and barcode. Ordering accepts
`name`, `selling_price`, `created_at`, and `updated_at` (prefix with `-` for
descending). Category responses contain only `id` and `name`; product responses
do not expose a shop identifier or inventory state.

### Second-language names

`Shop` exposes `primary_language` (default `ENGLISH`) and `secondary_language`
(`""` when unset), both from `ENGLISH`, `ARABIC`, `MALAYALAM`, `HINDI`, `URDU`.
`secondary_language` is also included on the session shop payload from
`GET /api/v1/auth/me/`, so catalogue forms can label the field without a second
request.

Products and categories carry a writable `secondary_name`, `""` when unset.
Product search (`/api/v1/products/`) and billing search (`/api/v1/inventory/`)
match it alongside `name`, `sku`, and `barcode`.

Sale items expose `product.secondary_name`, snapshotted at sale time next to
`product.name` - a reprint shows the name as sold, even after the product is
renamed or the shop changes its secondary language.

### Product image

- `POST /api/v1/products/{uuid}/image/` - owner-only, `multipart/form-data`,
  field `image`. Replaces any existing image and deletes the old file.
- `DELETE /api/v1/products/{uuid}/image/` - owner-only, idempotent.

Both return the full product. Validation rejects anything over 5 MB or whose
*decoded* format is not JPEG, PNG, or WEBP (the declared content type and the
filename are not trusted), using the standard error envelope with
`errors.image`.

`image_url` is `null` when no image is set and is serialized on the product,
inventory (`product.image_url`), and sale-item (`product.image_url`)
representations. Sale items snapshot name/SKU/unit at sale time but read the
image live, so a receipt reprint shows the product's current photo. URLs are
absolute and produced by the configured storage backend; with the default
`FileSystemStorage` they resolve under `MEDIA_URL`, which Django serves only
when `DEBUG` is on; production serves `/media/` from the web server or a
cloud backend selected via `DJANGO_DEFAULT_FILE_STORAGE`.

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
