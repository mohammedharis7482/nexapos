import hashlib
import secrets
from dataclasses import dataclass
from datetime import timedelta
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.contrib.sessions.models import Session
from django.db import transaction
from django.db.models.functions import Lower
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from apps.accounts.models import User
from apps.products.models import Product
from apps.shops.models import Shop

from .models import (
    AuditEvent,
    EmailVerificationToken,
    PasswordResetToken,
    Plan,
    ShopInvitation,
    ShopSubscription,
)
from .email_service import DeliveryResult, send_templated_email

TOKEN_LIFETIME = timedelta(hours=24)
RESET_TOKEN_LIFETIME = timedelta(hours=1)


class SaasOperationError(Exception):
    def __init__(
        self,
        message: str,
        field: str = "non_field_errors",
        *,
        code: str | None = None,
    ):
        self.message = message
        self.field = field
        self.code = code
        super().__init__(message)


@dataclass(frozen=True)
class RegistrationResult:
    shop: Shop
    owner: User
    email_delivery: DeliveryResult | None
    verification_required: bool


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def invalidate_user_sessions(
    user: User, *, exclude_session_key: str | None = None
) -> None:
    user_id = str(user.pk)
    for session in Session.objects.filter(expire_date__gt=timezone.now()).iterator():
        if session.session_key == exclude_session_key:
            continue
        if session.get_decoded().get("_auth_user_id") == user_id:
            session.delete()


def _new_token() -> tuple[str, str]:
    raw = secrets.token_urlsafe(32)
    return raw, hash_token(raw)


def _frontend_url(path: str, token: str) -> str:
    base = settings.FRONTEND_BASE_URL.rstrip("/")
    return f"{base}{path}?{urlencode({'token': token})}"


def _send_action_email(
    *,
    subject: str,
    recipient: str,
    template: str,
    context: dict,
) -> DeliveryResult:
    return send_templated_email(
        event=template,
        subject=subject,
        recipient=recipient,
        template=template,
        context=context,
        user_id=context.get("user_id"),
        shop_id=context.get("shop_id"),
    )


def get_default_plan() -> Plan:
    try:
        return Plan.objects.get(code=settings.DEFAULT_SAAS_PLAN_CODE, is_active=True)
    except Plan.DoesNotExist as exc:
        raise SaasOperationError(
            "Registration is temporarily unavailable. Please contact support."
        ) from exc


def _create_verification_token_record(
    user: User,
) -> tuple[EmailVerificationToken, str]:
    now = timezone.now()
    EmailVerificationToken.objects.filter(
        user=user, used_at__isnull=True, expires_at__gt=now
    ).update(used_at=now)
    raw, digest = _new_token()
    token = EmailVerificationToken.objects.create(
        user=user,
        token_hash=digest,
        expires_at=now + TOKEN_LIFETIME,
    )
    return token, raw


def send_verification_email(user: User, raw_token: str) -> DeliveryResult:
    return _send_action_email(
        subject="Verify your NexaPOS email",
        recipient=user.email,
        template="verify_email",
        context={
            "name": user.full_name,
            "username": user.username,
            "shop_name": user.shop.name,
            "shop_id": str(user.shop_id),
            "user_id": str(user.id),
            "action_url": _frontend_url("/verify-email", raw_token),
            "expires_hours": 24,
        },
    )


def create_verification_token(
    user: User,
) -> tuple[EmailVerificationToken, DeliveryResult]:
    with transaction.atomic():
        token, raw = _create_verification_token_record(user)
    return token, send_verification_email(user, raw)


def register_shop(
    *,
    shop_name: str,
    owner_full_name: str,
    owner_email: str,
    owner_username: str,
    password: str,
    address: str,
    phone: str,
    country: str = "Qatar",
    timezone_name: str = "Asia/Qatar",
    currency: str = "QAR",
    shop_id=None,
) -> RegistrationResult:
    normalized_email = User.objects.normalize_email_address(owner_email)
    if User.objects.annotate(email_ci=Lower("email")).filter(
        email_ci=normalized_email
    ).exists():
        raise SaasOperationError(
            "An account may already exist with these details. Sign in or request "
            "another verification message.",
            code="ACCOUNT_MAY_EXIST",
        )
    if Shop.objects.filter(name__iexact=shop_name.strip()).exists():
        raise SaasOperationError(
            "An account may already exist with these details. Sign in or request "
            "another verification message.",
            code="ACCOUNT_MAY_EXIST",
        )
    prospective = User(
        full_name=owner_full_name.strip(),
        username=owner_username,
        email=normalized_email,
        role=User.Role.OWNER,
    )
    validate_password(password, user=prospective)
    with transaction.atomic():
        plan = get_default_plan()
        now = timezone.now()
        verification_required = settings.REQUIRE_EMAIL_VERIFICATION
        shop = Shop.objects.create(
            **({"id": shop_id} if shop_id else {}),
            name=shop_name.strip(),
            address=address.strip(),
            phone=phone.strip(),
            email=normalized_email,
            country=country,
            timezone=timezone_name,
            currency=currency,
            status=(
                Shop.Status.PENDING_VERIFICATION
                if verification_required
                else Shop.Status.ONBOARDING
            ),
            is_active=True,
        )
        owner = User.objects.create_user(
            shop=shop,
            username=owner_username,
            password=password,
            full_name=owner_full_name.strip(),
            email=normalized_email,
            role=User.Role.OWNER,
            is_active=True,
            activated_at=now,
            email_verified_at=None if verification_required else now,
        )
        shop.primary_owner = owner
        shop.save(update_fields=["primary_owner", "updated_at"])
        ShopSubscription.objects.create(
            shop=shop,
            plan=plan,
            status=ShopSubscription.Status.TRIAL,
            trial_started_at=now,
            trial_ends_at=now + timedelta(days=plan.trial_days),
        )
        AuditEvent.objects.create(
            shop=shop,
            actor=owner,
            event=AuditEvent.Event.SHOP_REGISTERED,
            target_user=owner,
        )
        raw = None
        if verification_required:
            _token, raw = _create_verification_token_record(owner)
    delivery = send_verification_email(owner, raw) if raw else None
    return RegistrationResult(
        shop=shop,
        owner=owner,
        email_delivery=delivery,
        verification_required=verification_required,
    )


@transaction.atomic
def verify_email(raw_token: str) -> User:
    now = timezone.now()
    token = (
        EmailVerificationToken.objects.select_for_update()
        .select_related("user__shop")
        .filter(token_hash=hash_token(raw_token))
        .first()
    )
    if token is None:
        raise SaasOperationError(
            "This verification link is invalid.",
            code="INVALID_VERIFICATION_TOKEN",
        )
    if token.used_at:
        replaced = EmailVerificationToken.objects.filter(
            user=token.user,
            created_at__gt=token.created_at,
        ).exists()
        raise SaasOperationError(
            (
                "This verification link was replaced. Use the latest message."
                if replaced
                else "This verification link has already been used."
            ),
            code=(
                "VERIFICATION_TOKEN_REPLACED"
                if replaced
                else "VERIFICATION_TOKEN_USED"
            ),
        )
    if token.expires_at <= now:
        raise SaasOperationError(
            "This verification link has expired.",
            code="VERIFICATION_TOKEN_EXPIRED",
        )
    token.used_at = now
    token.save(update_fields=["used_at", "updated_at"])
    user = token.user
    user.email_verified_at = now
    user.save(update_fields=["email_verified_at", "updated_at"])
    shop = user.shop
    if shop.status == Shop.Status.PENDING_VERIFICATION:
        shop.status = Shop.Status.ONBOARDING
        shop.save(update_fields=["status", "updated_at"])
    return user


def resend_verification(
    *,
    email: str | None = None,
    shop_id=None,
    username: str | None = None,
) -> DeliveryResult | None:
    if not settings.REQUIRE_EMAIL_VERIFICATION:
        return None
    users = User.objects.select_related("shop").filter(is_active=True)
    if email:
        user = users.filter(email__iexact=email.strip()).first()
    elif shop_id and username:
        user = users.filter(
            shop_id=shop_id,
            username=User.objects.normalize_username(username),
        ).first()
    else:
        user = None
    if user and user.email and user.email_verified_at is None:
        _token, delivery = create_verification_token(user)
        return delivery
    return None


def usage_for_shop(shop: Shop) -> dict:
    subscription = (
        ShopSubscription.objects.select_related("plan").filter(shop=shop).first()
    )
    plan = subscription.plan if subscription else get_default_plan()
    active_users = User.objects.filter(shop=shop, is_active=True).count()
    active_products = Product.objects.filter(shop=shop, is_active=True).count()
    return {
        "active_users": active_users,
        "max_users": plan.max_users,
        "active_products": active_products,
        "max_products": plan.max_products,
    }


def enforce_user_limit(shop: Shop) -> None:
    usage = usage_for_shop(shop)
    if usage["active_users"] >= usage["max_users"]:
        raise SaasOperationError(
            "The system active-account safety limit has been reached."
        )


def enforce_product_limit(shop: Shop) -> None:
    usage = usage_for_shop(shop)
    if usage["active_products"] >= usage["max_products"]:
        raise SaasOperationError(
            "The active-product limit for this plan has been reached."
        )


def user_is_primary_owner(user: User) -> bool:
    return bool(user.shop.primary_owner_id == user.id)


def can_manage_role(actor: User, role: str) -> bool:
    if actor.is_superuser or user_is_primary_owner(actor):
        return role in (User.Role.OWNER, User.Role.CASHIER)
    return actor.role == User.Role.OWNER and role == User.Role.CASHIER


@transaction.atomic
def create_staff_user(
    *,
    actor: User,
    full_name: str,
    username: str,
    temporary_password: str,
    role: str,
    email: str = "",
) -> User:
    if not can_manage_role(actor, role):
        raise PermissionDenied("You cannot create this role.")
    enforce_user_limit(actor.shop)
    normalized_username = User.objects.normalize_username(username)
    normalized_email = (
        User.objects.normalize_email_address(email) if email.strip() else ""
    )
    if User.objects.select_for_update().filter(
        shop=actor.shop, username__iexact=normalized_username
    ).exists():
        raise SaasOperationError(
            "A user with this username already exists.", "username"
        )
    prospective = User(
        shop=actor.shop,
        username=normalized_username,
        full_name=full_name.strip(),
        email=normalized_email,
        role=role,
        created_by=actor,
    )
    validate_password(temporary_password, user=prospective)
    now = timezone.now()
    user = User.objects.create_user(
        shop=actor.shop,
        username=normalized_username,
        password=temporary_password,
        full_name=full_name.strip(),
        email=normalized_email,
        role=role,
        created_by=actor,
        is_active=True,
        activated_at=now,
        email_verified_at=now,
        must_change_password=True,
    )
    AuditEvent.objects.create(
        shop=actor.shop,
        actor=actor,
        target_user=user,
        event=AuditEvent.Event.STAFF_USER_CREATED,
        detail=role,
    )
    return user


@transaction.atomic
def update_staff_profile(
    *, actor: User, target: User, full_name: str | None, email: str | None
) -> User:
    if target.shop_id != actor.shop_id:
        raise PermissionDenied("User not found.")
    if target.role == User.Role.OWNER and not user_is_primary_owner(actor):
        raise PermissionDenied("Only the primary owner can edit owners.")
    if full_name is not None:
        target.full_name = full_name.strip()
    if email is not None:
        target.email = (
            User.objects.normalize_email_address(email) if email.strip() else ""
        )
    target.full_clean(exclude=["password"])
    target.save()
    AuditEvent.objects.create(
        shop=actor.shop,
        actor=actor,
        target_user=target,
        event=AuditEvent.Event.USER_PROFILE_UPDATED,
    )
    return target


@transaction.atomic
def reset_staff_password(
    *, actor: User, target: User, temporary_password: str
) -> User:
    if target.shop_id != actor.shop_id:
        raise PermissionDenied("User not found.")
    if target.id == actor.id:
        raise SaasOperationError("Use your account page to change your password.")
    if target.shop.primary_owner_id == target.id:
        raise SaasOperationError(
            "The primary owner password cannot be reset from Team."
        )
    if target.role == User.Role.OWNER and not user_is_primary_owner(actor):
        raise PermissionDenied("Only the primary owner can reset owner passwords.")
    validate_password(temporary_password, user=target)
    target.set_password(temporary_password)
    target.must_change_password = True
    target.password_changed_at = timezone.now()
    target.save(
        update_fields=[
            "password",
            "must_change_password",
            "password_changed_at",
            "updated_at",
        ]
    )
    invalidate_user_sessions(target)
    AuditEvent.objects.create(
        shop=actor.shop,
        actor=actor,
        target_user=target,
        event=AuditEvent.Event.STAFF_PASSWORD_RESET,
    )
    return target


@transaction.atomic
def create_invitation(
    *, actor: User, email: str, role: str, full_name: str = ""
) -> ShopInvitation:
    if not can_manage_role(actor, role):
        raise PermissionDenied("You cannot invite this role.")
    enforce_user_limit(actor.shop)
    normalized = User.objects.normalize_email_address(email)
    if User.objects.filter(
        shop=actor.shop, email__iexact=normalized, is_active=True
    ).exists():
        raise SaasOperationError("An active user with this email already exists.", "email")
    now = timezone.now()
    existing = ShopInvitation.objects.filter(
        shop=actor.shop,
        email__iexact=normalized,
        accepted_at__isnull=True,
        revoked_at__isnull=True,
        expires_at__gt=now,
    ).first()
    if existing:
        raise SaasOperationError("A pending invitation already exists.", "email")
    ShopInvitation.objects.filter(
        shop=actor.shop,
        email__iexact=normalized,
        accepted_at__isnull=True,
        revoked_at__isnull=True,
        expires_at__lte=now,
    ).update(revoked_at=now)
    raw, digest = _new_token()
    invitation = ShopInvitation.objects.create(
        shop=actor.shop,
        email=normalized,
        full_name=full_name.strip(),
        role=role,
        token_hash=digest,
        invited_by=actor,
        expires_at=now + TOKEN_LIFETIME,
    )
    _send_invitation(invitation, raw)
    AuditEvent.objects.create(
        shop=actor.shop,
        actor=actor,
        event=AuditEvent.Event.INVITATION_SENT,
        detail=role,
    )
    return invitation


def _send_invitation(invitation: ShopInvitation, raw_token: str) -> None:
    _send_action_email(
        subject=f"You are invited to {invitation.shop.name} on NexaPOS",
        recipient=invitation.email,
        template="invitation",
        context={
            "shop_name": invitation.shop.name,
            "role": invitation.get_role_display(),
            "inviter": invitation.invited_by.full_name,
            "action_url": _frontend_url("/accept-invitation", raw_token),
            "expires_hours": 24,
        },
    )


@transaction.atomic
def resend_invitation(*, actor: User, invitation: ShopInvitation) -> ShopInvitation:
    if invitation.accepted_at or invitation.revoked_at:
        raise SaasOperationError("Only pending invitations can be resent.")
    raw, digest = _new_token()
    invitation.token_hash = digest
    invitation.expires_at = timezone.now() + TOKEN_LIFETIME
    invitation.save(update_fields=["token_hash", "expires_at", "updated_at"])
    _send_invitation(invitation, raw)
    return invitation


@transaction.atomic
def revoke_invitation(*, invitation: ShopInvitation) -> ShopInvitation:
    if invitation.accepted_at:
        raise SaasOperationError("Accepted invitations cannot be revoked.")
    if invitation.revoked_at is None:
        invitation.revoked_at = timezone.now()
        invitation.save(update_fields=["revoked_at", "updated_at"])
    return invitation


def invitation_context(raw_token: str) -> ShopInvitation:
    invitation = (
        ShopInvitation.objects.select_related("shop", "invited_by")
        .filter(token_hash=hash_token(raw_token))
        .first()
    )
    if (
        invitation is None
        or invitation.accepted_at
        or invitation.revoked_at
        or invitation.expires_at <= timezone.now()
    ):
        raise SaasOperationError("This invitation is invalid or has expired.")
    if invitation.shop.status not in (
        Shop.Status.ONBOARDING,
        Shop.Status.TRIAL,
        Shop.Status.ACTIVE,
        Shop.Status.PAST_DUE,
    ):
        raise SaasOperationError("This shop is not accepting invitations.")
    return invitation


@transaction.atomic
def accept_invitation(
    *, raw_token: str, full_name: str, username: str, password: str
) -> User:
    invitation = (
        ShopInvitation.objects.select_for_update()
        .select_related("shop")
        .filter(token_hash=hash_token(raw_token))
        .first()
    )
    now = timezone.now()
    if (
        invitation is None
        or invitation.accepted_at
        or invitation.revoked_at
        or invitation.expires_at <= now
    ):
        raise SaasOperationError("This invitation is invalid or has expired.")
    if invitation.shop.status not in (
        Shop.Status.ONBOARDING,
        Shop.Status.TRIAL,
        Shop.Status.ACTIVE,
        Shop.Status.PAST_DUE,
    ):
        raise SaasOperationError("This shop is not accepting invitations.")
    enforce_user_limit(invitation.shop)
    existing_user = User.objects.select_for_update().filter(
        shop=invitation.shop, email__iexact=invitation.email
    ).first()
    username_conflict = User.objects.filter(
        shop=invitation.shop, username__iexact=username.strip()
    )
    if existing_user:
        username_conflict = username_conflict.exclude(pk=existing_user.pk)
    if username_conflict.exists():
        raise SaasOperationError("This username is unavailable.", "username")
    user = existing_user or User(shop=invitation.shop, email=invitation.email)
    user.username = username
    user.full_name = full_name.strip()
    user.role = invitation.role
    validate_password(password, user=user)
    if existing_user:
        user.is_active = True
        user.email_verified_at = now
        user.invited_at = invitation.created_at
        user.activated_at = now
        user.deactivated_at = None
        user.set_password(password)
        user.full_clean(exclude=["password"])
        user.save()
    else:
        user = User.objects.create_user(
            shop=invitation.shop,
            username=username,
            password=password,
            full_name=full_name.strip(),
            email=invitation.email,
            role=invitation.role,
            email_verified_at=now,
            invited_at=invitation.created_at,
            activated_at=now,
        )
    invitation.accepted_at = now
    invitation.save(update_fields=["accepted_at", "updated_at"])
    AuditEvent.objects.create(
        shop=invitation.shop,
        actor=invitation.invited_by,
        event=AuditEvent.Event.INVITATION_ACCEPTED,
        target_user=user,
        detail=invitation.role,
    )
    return user


def request_password_reset(email: str) -> None:
    user = User.objects.filter(email__iexact=email.strip(), is_active=True).first()
    if not user or not user.email:
        return
    now = timezone.now()
    PasswordResetToken.objects.filter(
        user=user, used_at__isnull=True, expires_at__gt=now
    ).update(used_at=now)
    raw, digest = _new_token()
    PasswordResetToken.objects.create(
        user=user, token_hash=digest, expires_at=now + RESET_TOKEN_LIFETIME
    )
    _send_action_email(
        subject="Reset your NexaPOS password",
        recipient=user.email,
        template="password_reset",
        context={
            "name": user.full_name,
            "action_url": _frontend_url("/reset-password", raw),
            "expires_hours": 1,
        },
    )


@transaction.atomic
def confirm_password_reset(*, raw_token: str, new_password: str) -> User:
    now = timezone.now()
    token = (
        PasswordResetToken.objects.select_for_update()
        .select_related("user__shop")
        .filter(token_hash=hash_token(raw_token))
        .first()
    )
    if token is None or token.used_at or token.expires_at <= now:
        raise SaasOperationError("This password reset link is invalid or has expired.")
    user = token.user
    validate_password(new_password, user=user)
    user.set_password(new_password)
    user.password_changed_at = now
    user.save(update_fields=["password", "password_changed_at", "updated_at"])
    token.used_at = now
    token.save(update_fields=["used_at", "updated_at"])
    PasswordResetToken.objects.filter(
        user=user, used_at__isnull=True
    ).update(used_at=now)
    invalidate_user_sessions(user)
    AuditEvent.objects.create(
        shop=user.shop,
        actor=user,
        event=AuditEvent.Event.PASSWORD_RESET,
        target_user=user,
    )
    return user


@transaction.atomic
def update_user_role(*, actor: User, target: User, role: str) -> User:
    if target.shop_id != actor.shop_id:
        raise PermissionDenied("User not found.")
    if target.shop.primary_owner_id == target.id:
        raise SaasOperationError("The primary owner role cannot be changed.")
    if not can_manage_role(actor, role):
        raise PermissionDenied("You cannot assign this role.")
    target.role = role
    target.role_changed_at = timezone.now()
    target.save(update_fields=["role", "role_changed_at", "updated_at"])
    invalidate_user_sessions(target)
    AuditEvent.objects.create(
        shop=actor.shop,
        actor=actor,
        event=AuditEvent.Event.ROLE_CHANGED,
        target_user=target,
        detail=role,
    )
    return target


@transaction.atomic
def set_user_active(*, actor: User, target: User, active: bool) -> User:
    if target.shop_id != actor.shop_id:
        raise PermissionDenied("User not found.")
    if target.id == actor.id and not active:
        raise SaasOperationError("You cannot deactivate your own account.")
    if target.shop.primary_owner_id == target.id and not active:
        raise SaasOperationError("The primary owner cannot be deactivated.")
    if target.role == User.Role.OWNER and not user_is_primary_owner(actor):
        raise PermissionDenied("Only the primary owner can manage owners.")
    if active and not target.is_active:
        enforce_user_limit(actor.shop)
    now = timezone.now()
    target.is_active = active
    target.activated_at = now if active else target.activated_at
    target.deactivated_at = None if active else now
    target.save(
        update_fields=["is_active", "activated_at", "deactivated_at", "updated_at"]
    )
    if not active:
        invalidate_user_sessions(target)
    AuditEvent.objects.create(
        shop=actor.shop,
        actor=actor,
        event=(
            AuditEvent.Event.USER_ACTIVATED
            if active
            else AuditEvent.Event.USER_DEACTIVATED
        ),
        target_user=target,
    )
    return target


@transaction.atomic
def complete_onboarding(shop: Shop) -> Shop:
    now = timezone.now()
    shop.onboarding_current_step = 7
    shop.onboarding_completed_at = now
    if shop.status in (
        Shop.Status.PENDING_VERIFICATION,
        Shop.Status.ONBOARDING,
    ):
        shop.status = Shop.Status.TRIAL
    shop.save(
        update_fields=[
            "onboarding_current_step",
            "onboarding_completed_at",
            "status",
            "updated_at",
        ]
    )
    return shop


@transaction.atomic
def transition_subscription(
    *, subscription: ShopSubscription, status: str
) -> ShopSubscription:
    mapping = {
        ShopSubscription.Status.TRIAL: Shop.Status.TRIAL,
        ShopSubscription.Status.ACTIVE: Shop.Status.ACTIVE,
        ShopSubscription.Status.PAST_DUE: Shop.Status.PAST_DUE,
        ShopSubscription.Status.SUSPENDED: Shop.Status.SUSPENDED,
        ShopSubscription.Status.CANCELLED: Shop.Status.CANCELLED,
    }
    now = timezone.now()
    subscription.status = status
    subscription.cancelled_at = (
        now if status == ShopSubscription.Status.CANCELLED else None
    )
    subscription.save(update_fields=["status", "cancelled_at", "updated_at"])
    shop = subscription.shop
    shop.status = mapping[status]
    shop.is_active = status != ShopSubscription.Status.CANCELLED
    shop.suspended_at = now if status == ShopSubscription.Status.SUSPENDED else None
    shop.cancelled_at = now if status == ShopSubscription.Status.CANCELLED else None
    if status == ShopSubscription.Status.ACTIVE and shop.activated_at is None:
        shop.activated_at = now
    shop.save(
        update_fields=[
            "status",
            "is_active",
            "suspended_at",
            "cancelled_at",
            "activated_at",
            "updated_at",
        ]
    )
    return subscription
