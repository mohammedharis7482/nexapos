import logging
from typing import Any

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger("nexapos.api")


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
    if isinstance(detail, dict) and set(detail) == {"detail"}:
        message = str(detail["detail"])

    response.data = {
        "success": False,
        "message": message,
        "errors": detail if isinstance(detail, (dict, list)) else {"detail": detail},
    }
    return response
