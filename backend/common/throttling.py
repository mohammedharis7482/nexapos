import hashlib

from rest_framework.throttling import SimpleRateThrottle


class LoginIpThrottle(SimpleRateThrottle):
    """Bound login traffic per client IP as a first application-level guard."""

    scope = "login_ip"

    def get_cache_key(self, request, view) -> str:
        return self.cache_format % {
            "scope": self.scope,
            "ident": self.get_ident(request),
        }


class LoginContextThrottle(SimpleRateThrottle):
    """Bound attempts for an IP/shop/username tuple without storing raw identifiers."""

    scope = "login_context"

    def get_cache_key(self, request, view) -> str:
        shop_id = str(request.data.get("shop_id", "")).strip().lower()
        username = str(request.data.get("username", "")).strip().lower()
        context = f"{self.get_ident(request)}:{shop_id}:{username}"
        digest = hashlib.sha256(context.encode("utf-8")).hexdigest()
        return self.cache_format % {"scope": self.scope, "ident": digest}
