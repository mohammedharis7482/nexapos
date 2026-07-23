from django.conf import settings
from drf_spectacular.extensions import OpenApiAuthenticationExtension


class ApiSessionAuthenticationScheme(OpenApiAuthenticationExtension):
    target_class = "common.authentication.ApiSessionAuthentication"
    name = "cookieAuth"

    def get_security_definition(self, auto_schema):
        return {
            "type": "apiKey",
            "in": "cookie",
            "name": settings.SESSION_COOKIE_NAME,
            "description": (
                "Django server-side session cookie. Unsafe requests also require "
                "the CSRF cookie value in the X-CSRFToken header."
            ),
        }
