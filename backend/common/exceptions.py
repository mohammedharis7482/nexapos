from typing import Any

from rest_framework.response import Response
from rest_framework.views import exception_handler


def api_exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    """Wrap handled DRF errors in the public NexaPOS error contract."""

    response = exception_handler(exc, context)
    if response is None:
        return None

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
