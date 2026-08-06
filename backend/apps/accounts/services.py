import logging

from django.conf import settings
from django.contrib.auth import login, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework.exceptions import APIException

from .models import User
from apps.saas.models import AuditEvent
from apps.saas.services import invalidate_user_sessions
from apps.shops.models import Shop

INVALID_CREDENTIALS_MESSAGE = "Invalid shop or credentials."
logger = logging.getLogger("nexapos.api")


class LoginDenied(APIException):
    def __init__(self, *, code: str, detail: str, status_code: int, **context):
        self.status_code = status_code
        self.response_context = context
        super().__init__({"code": code, "detail": detail})


def deny_login(code: str, detail: str, status_code: int, **context):
    logger.debug("login_denied", extra={"reason": code})
    raise LoginDenied(
        code=code,
        detail=detail,
        status_code=status_code,
        **context,
    )


def login_user(*, request, shop_id, username: str, password: str) -> User:
    normalized_username = User.objects.normalize_username(username)
    try:
        user = User.objects.select_related("shop").get(
            shop_id=shop_id,
            username=normalized_username,
        )
    except User.DoesNotExist:
        User().set_password(password)
        deny_login("INVALID_CREDENTIALS", INVALID_CREDENTIALS_MESSAGE, 401)

    if not user.check_password(password):
        deny_login("INVALID_CREDENTIALS", INVALID_CREDENTIALS_MESSAGE, 401)
    if not user.is_active:
        deny_login("USER_INACTIVE", "This account is inactive.", 403)
    if not user.shop.is_active:
        deny_login("SHOP_SUSPENDED", "This shop is not currently active.", 403)
    if user.shop.status == Shop.Status.CANCELLED:
        deny_login("SHOP_CANCELLED", "This shop has been cancelled.", 403)
    if (
        settings.REQUIRE_EMAIL_VERIFICATION
        and user.shop.status == Shop.Status.PENDING_VERIFICATION
        and user.email_verified_at is None
    ):
        deny_login(
            "EMAIL_NOT_VERIFIED",
            "Verify your email before signing in.",
            403,
            can_resend_verification=True,
        )
    if (
        settings.REQUIRE_EMAIL_VERIFICATION
        and user.shop.status == Shop.Status.PENDING_VERIFICATION
    ):
        deny_login("INVALID_CREDENTIALS", INVALID_CREDENTIALS_MESSAGE, 401)

    login(request, user, backend="common.authentication.ShopModelBackend")

    AuditEvent.objects.create(
        shop=user.shop,
        actor=user,
        target_user=user,
        event=AuditEvent.Event.USER_LOGIN,
    )
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
    if user.check_password(new_password):
        raise ValidationError(
            {"new_password": ["Choose a password different from the current one."]}
        )

    validate_password(new_password, user=user)
    user.set_password(new_password)
    user.must_change_password = False
    user.password_changed_at = timezone.now()
    user.save(
        update_fields=[
            "password",
            "must_change_password",
            "password_changed_at",
            "updated_at",
        ]
    )
    invalidate_user_sessions(
        user, exclude_session_key=request.session.session_key
    )
    update_session_auth_hash(request, user)

    AuditEvent.objects.create(
        shop=user.shop,
        actor=user,
        target_user=user,
        event=AuditEvent.Event.PASSWORD_CHANGED,
    )
