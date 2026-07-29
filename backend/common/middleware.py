import uuid
from django.http import JsonResponse


class RequestIdMiddleware:
    """Attach a non-sensitive correlation identifier to every request/response."""

    header_name = "X-Request-ID"

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.request_id = uuid.uuid4().hex
        response = self.get_response(request)
        response[self.header_name] = request.request_id
        return response


class ForcedPasswordChangeMiddleware:
    """Restrict temporary-password sessions to account security endpoints."""

    allowed_paths = {
        "/api/v1/auth/me/",
        "/api/v1/auth/csrf/",
        "/api/v1/auth/logout/",
        "/api/v1/auth/change-password/",
        "/api/v1/auth/account/",
        "/api/v1/auth/logout-all/",
    }

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, "user", None)
        if (
            request.path.startswith("/api/v1/")
            and user
            and user.is_authenticated
            and user.must_change_password
            and request.path not in self.allowed_paths
        ):
            return JsonResponse(
                {
                    "success": False,
                    "message": "Change your temporary password to continue.",
                    "code": "PASSWORD_CHANGE_REQUIRED",
                    "errors": {},
                },
                status=403,
            )
        return self.get_response(request)
