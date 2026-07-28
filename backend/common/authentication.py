from typing import Any

from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.base_user import AbstractBaseUser
from django.contrib.auth import get_user_model
from django.contrib.auth import logout
from rest_framework.authentication import SessionAuthentication


class ApiSessionAuthentication(SessionAuthentication):
    """Django session authentication with API-appropriate 401 responses."""

    def authenticate_header(self, request) -> str:
        return "Session"

    def authenticate(self, request):
        authenticated = super().authenticate(request)
        if authenticated is None:
            return None
        user, auth = authenticated
        if not user.is_active or not user.shop.is_active:
            logout(request._request)
            return None
        return user, auth


def enforce_csrf(request) -> None:
    """Enforce CSRF for unsafe public views such as session login."""

    SessionAuthentication().enforce_csrf(request)


class ShopModelBackend(ModelBackend):
    """Authenticate a username within a shop.

    Admin authentication may omit ``shop_id`` only where the username identifies
    exactly one user. Business login endpoints must supply the shop explicitly.
    """

    def authenticate(
        self,
        request,
        username: str | None = None,
        password: str | None = None,
        shop_id: str | None = None,
        **kwargs: Any,
    ) -> AbstractBaseUser | None:
        if username is None or password is None:
            return None

        user_model = get_user_model()
        lookup: dict[str, Any] = {"username": username.strip().lower()}
        if shop_id is not None:
            lookup["shop_id"] = shop_id

        try:
            user = user_model._default_manager.get(**lookup)
        except (user_model.DoesNotExist, user_model.MultipleObjectsReturned):
            user_model().set_password(password)
            return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
