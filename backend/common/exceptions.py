import logging
from typing import Any

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger("nexapos.api")


def _single_field_message(detail: Any) -> str | None:
    """Return the human-readable message from a single-field validation error.

    Domain rejections raised as ``ValidationError({field: message})`` -
    "Requested quantity exceeds available stock.", "This user already has an
    open shift." - carry their real reason under a field key rather than
    under ``detail``, so without this they would surface to the user as the
    generic fallback message with the actual reason buried in ``errors``.

    Returns None for anything that isn't a single key mapping to plain text
    (multi-field form errors, which intentionally keep the generic summary
    and render per-field; and structured payloads like ``import_errors``,
    whose list-of-dicts must never be stringified into a user-facing
    message).
    """
    if not isinstance(detail, dict) or len(detail) != 1:
        return None
    value = next(iter(detail.values()))
    if isinstance(value, (list, tuple)):
        if not value:
            return None
        value = value[0]
    return str(value) if isinstance(value, str) else None


def api_exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    """Wrap handled DRF errors in the public NexaPOS error contract."""

    response = exception_handler(exc, context)
    if response is None:
        request = context.get("request")
        user = getattr(request, "user", None)
        logger.error(
            "unhandled_api_exception",
            exc_info=(type(exc), exc, exc.__traceback__),
            extra={
                "request_id": getattr(request, "request_id", None),
                "path": getattr(request, "path", None),
                "user_id": (
                    getattr(user, "pk", None)
                    if getattr(user, "is_authenticated", False)
                    else None
                ),
                "shop_id": (
                    getattr(user, "shop_id", None)
                    if getattr(user, "is_authenticated", False)
                    else None
                ),
            },
        )
        return Response(
            {
                "success": False,
                "message": "NexaPOS could not complete the request.",
                "errors": {},
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    detail = response.data
    message = "Please check the entered details."
    error_code = None
    response_errors = detail
    if isinstance(detail, dict) and "code" in detail:
        error_code = str(detail["code"])
        safe_detail = detail.get("detail", detail.get("non_field_errors"))
        if isinstance(safe_detail, (list, tuple)) and safe_detail:
            safe_detail = safe_detail[0]
        if safe_detail:
            message = str(safe_detail)
        response_errors = {
            key: value for key, value in detail.items() if key not in {"code", "detail"}
        }
        response_errors.update(getattr(exc, "response_context", {}))
    elif (single_message := _single_field_message(detail)) is not None:
        # Covers both the plain {"detail": ...} shape (404/403/throttle) and
        # single-field domain rejections. Multi-field form errors fall
        # through to the generic message on purpose - those forms show a
        # summary banner plus per-field errors from `errors`.
        message = single_message

    response.data = {
        "success": False,
        "message": message,
        "errors": (
            response_errors
            if isinstance(response_errors, (dict, list))
            else {"detail": response_errors}
        ),
    }
    if error_code:
        response.data["code"] = error_code
    return response
