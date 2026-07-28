from django.contrib.auth import authenticate, login, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from rest_framework.exceptions import AuthenticationFailed

from .models import User
from apps.shops.models import Shop

INVALID_CREDENTIALS_MESSAGE = "Invalid shop or credentials."


def login_user(*, request, shop_id, username: str, password: str) -> User:
    user = authenticate(
        request=request,
        shop_id=str(shop_id),
        username=username,
        password=password,
    )
    if (
        user is None
        or not user.shop.is_active
        or not user.is_active
        or user.shop.status in (
            Shop.Status.PENDING_VERIFICATION,
            Shop.Status.CANCELLED,
        )
    ):
        raise AuthenticationFailed(INVALID_CREDENTIALS_MESSAGE)

    login(request, user)
    return user


def change_user_password(
    *,
    request,
    user: User,
    current_password: str,
    new_password: str,
) -> None:
    if not user.check_password(current_password):
        raise ValidationError(
            {"current_password": ["The current password is incorrect."]}
        )

    validate_password(new_password, user=user)
    user.set_password(new_password)
    user.save(update_fields=["password", "updated_at"])
    from apps.saas.services import invalidate_user_sessions

    invalidate_user_sessions(
        user, exclude_session_key=request.session.session_key
    )
    update_session_auth_hash(request, user)
