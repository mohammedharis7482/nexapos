import uuid


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
