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

## Documentation

- `GET /api/schema/`: OpenAPI schema
- `GET /api/docs/`: Swagger UI
- `GET /api/redoc/`: ReDoc

No business resource APIs or JWT token endpoints exist in this phase.
