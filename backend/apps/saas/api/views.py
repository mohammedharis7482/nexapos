from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.api.serializers import ResendVerificationSerializer, SuccessSerializer
from apps.saas.models import Plan, ShopSubscription
from apps.saas.selectors import invitations_for_manager, users_for_manager
from apps.saas.services import (
    SaasOperationError,
    accept_invitation,
    complete_onboarding,
    confirm_password_reset,
    create_invitation,
    invitation_context,
    register_shop,
    request_password_reset,
    resend_invitation,
    resend_verification,
    revoke_invitation,
    set_user_active,
    update_user_role,
    usage_for_shop,
    user_is_primary_owner,
    verify_email,
)
from common.authentication import enforce_csrf
from common.permissions import IsOwner
from common.views import success_response

from .serializers import (
    AcceptInvitationSerializer,
    EmailSerializer,
    InvitationContextSerializer,
    InvitationSerializer,
    ManagedUserSerializer,
    OnboardingSerializer,
    PasswordResetConfirmSerializer,
    PlanSerializer,
    RegistrationSerializer,
    RegistrationErrorSerializer,
    RegistrationResponseSerializer,
    RoleChangeSerializer,
    SubscriptionSerializer,
    TokenSerializer,
    UserUpdateSerializer,
    VerificationResponseSerializer,
)


def operation_error(exc: Exception):
    if isinstance(exc, SaasOperationError):
        detail = {exc.field: exc.message}
        if exc.code:
            detail["code"] = exc.code
        raise serializers.ValidationError(detail) from exc
    if isinstance(exc, DjangoValidationError):
        detail = exc.message_dict if hasattr(exc, "message_dict") else exc.messages
        raise serializers.ValidationError(detail) from exc
    raise exc


class PublicCsrfViewMixin:
    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_account"

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method not in ("GET", "HEAD", "OPTIONS"):
            enforce_csrf(request)


class RegisterView(PublicCsrfViewMixin, APIView):
    @extend_schema(
        request=RegistrationSerializer,
        responses={
            201: RegistrationResponseSerializer,
            400: RegistrationErrorSerializer,
        },
    )
    def post(self, request):
        serializer = RegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            values = dict(serializer.validated_data)
            values["timezone_name"] = values.pop("timezone")
            result = register_shop(**values)
        except (SaasOperationError, DjangoValidationError) as exc:
            operation_error(exc)
        except IntegrityError as exc:
            diagnostic = getattr(exc.__cause__, "diag", None)
            if getattr(diagnostic, "constraint_name", None) == "shops_email_ci_uniq":
                operation_error(
                    SaasOperationError(
                        "An account may already exist with these details. Sign in "
                        "or request another verification message.",
                        code="ACCOUNT_MAY_EXIST",
                    )
                )
            raise
        delivery_status = (
            result.email_delivery.status.value
            if result.email_delivery
            else "NOT_REQUIRED"
        )
        delivery_failed = delivery_status == "EMAIL_DELIVERY_FAILED"
        if not result.verification_required:
            message = "Shop created successfully."
        elif delivery_failed:
            message = (
                "Your shop was created, but the verification email could not be "
                "delivered. Request another verification message."
            )
        else:
            message = "Shop created. Verify the owner email before signing in."
        return success_response(
            message,
            {
                "shop": {"id": str(result.shop.id), "name": result.shop.name},
                "owner": {"username": result.owner.username},
                "verification_required": result.verification_required,
                "owner_email": result.owner.email,
                "registration_status": result.shop.status,
                "email_delivery": delivery_status,
                "next_step": (
                    "VERIFY_EMAIL"
                    if result.verification_required
                    else "SIGN_IN"
                ),
            },
            status_code=status.HTTP_201_CREATED,
        )


class VerifyEmailView(PublicCsrfViewMixin, APIView):
    @extend_schema(
        request=TokenSerializer,
        responses={200: VerificationResponseSerializer},
    )
    def post(self, request):
        serializer = TokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = verify_email(serializer.validated_data["token"])
        except SaasOperationError as exc:
            operation_error(exc)
        return success_response(
            "Email verified. You can now sign in.",
            {
                "shop": {
                    "id": str(user.shop_id),
                    "name": user.shop.name,
                }
            },
        )


class ResendVerificationView(PublicCsrfViewMixin, APIView):
    @extend_schema(
        request=ResendVerificationSerializer,
        responses={200: SuccessSerializer},
    )
    def post(self, request):
        serializer = ResendVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        resend_verification(**serializer.validated_data)
        return success_response(
            "If an eligible unverified account exists, a verification delivery "
            "was attempted."
        )


class PasswordResetRequestView(PublicCsrfViewMixin, APIView):
    @extend_schema(request=EmailSerializer, responses={200: SuccessSerializer})
    def post(self, request):
        serializer = EmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request_password_reset(serializer.validated_data["email"])
        return success_response(
            "If an eligible account exists, password reset instructions have been sent."
        )


class PasswordResetConfirmView(PublicCsrfViewMixin, APIView):
    @extend_schema(
        request=PasswordResetConfirmSerializer, responses={200: SuccessSerializer}
    )
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            confirm_password_reset(
                raw_token=serializer.validated_data["token"],
                new_password=serializer.validated_data["new_password"],
            )
        except (SaasOperationError, DjangoValidationError) as exc:
            operation_error(exc)
        return success_response("Password reset successfully.")


class InvitationAcceptView(PublicCsrfViewMixin, APIView):
    @extend_schema(
        parameters=[OpenApiParameter("token", str, required=True)],
        responses={200: InvitationContextSerializer},
    )
    def get(self, request):
        try:
            invitation = invitation_context(request.query_params.get("token", ""))
        except SaasOperationError as exc:
            operation_error(exc)
        data = {
            "shop_name": invitation.shop.name,
            "email": invitation.email,
            "role": invitation.role,
            "inviter_name": invitation.invited_by.full_name,
            "expires_at": invitation.expires_at,
        }
        return success_response("Invitation retrieved.", data)

    @extend_schema(
        request=AcceptInvitationSerializer, responses={201: SuccessSerializer}
    )
    def post(self, request):
        serializer = AcceptInvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = accept_invitation(
                raw_token=serializer.validated_data["token"],
                full_name=serializer.validated_data["full_name"],
                username=serializer.validated_data["username"],
                password=serializer.validated_data["password"],
            )
        except (SaasOperationError, DjangoValidationError) as exc:
            operation_error(exc)
        return success_response(
            "Invitation accepted. You can now sign in.",
            {"shop_id": str(user.shop_id)},
            status_code=status.HTTP_201_CREATED,
        )


class UserListView(APIView):
    permission_classes = [IsOwner]

    @extend_schema(responses={200: ManagedUserSerializer(many=True)})
    def get(self, request):
        users = users_for_manager(request.user)
        return success_response(
            "Users retrieved.",
            {
                "results": ManagedUserSerializer(users, many=True).data,
                "usage": usage_for_shop(request.user.shop),
            },
        )


class UserDetailView(APIView):
    permission_classes = [IsOwner]

    def get_object(self, request, user_id):
        return get_object_or_404(users_for_manager(request.user), pk=user_id)

    @extend_schema(responses={200: ManagedUserSerializer})
    def get(self, request, user_id):
        return success_response(
            "User retrieved.", ManagedUserSerializer(self.get_object(request, user_id)).data
        )

    @extend_schema(request=UserUpdateSerializer, responses={200: ManagedUserSerializer})
    @transaction.atomic
    def patch(self, request, user_id):
        target = self.get_object(request, user_id)
        if target.role == User.Role.OWNER and not user_is_primary_owner(request.user):
            raise serializers.ValidationError(
                {"detail": "Only the primary owner can edit owners."}
            )
        serializer = UserUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            setattr(target, field, value.strip())
        target.full_clean(exclude=["password"])
        target.save()
        return success_response("User updated.", ManagedUserSerializer(target).data)


class UserActivationView(APIView):
    permission_classes = [IsOwner]
    active = True

    @extend_schema(request=None, responses={200: ManagedUserSerializer})
    def post(self, request, user_id):
        target = get_object_or_404(users_for_manager(request.user), pk=user_id)
        try:
            target = set_user_active(actor=request.user, target=target, active=self.active)
        except SaasOperationError as exc:
            operation_error(exc)
        return success_response(
            "User activated." if self.active else "User deactivated.",
            ManagedUserSerializer(target).data,
        )


class UserDeactivateView(UserActivationView):
    active = False


class UserRoleView(APIView):
    permission_classes = [IsOwner]

    @extend_schema(request=RoleChangeSerializer, responses={200: ManagedUserSerializer})
    def post(self, request, user_id):
        target = get_object_or_404(users_for_manager(request.user), pk=user_id)
        serializer = RoleChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            target = update_user_role(
                actor=request.user,
                target=target,
                role=serializer.validated_data["role"],
            )
        except SaasOperationError as exc:
            operation_error(exc)
        return success_response("User role updated.", ManagedUserSerializer(target).data)


class InvitationListCreateView(APIView):
    permission_classes = [IsOwner]

    @extend_schema(responses={200: InvitationSerializer(many=True)})
    def get(self, request):
        return success_response(
            "Invitations retrieved.",
            InvitationSerializer(invitations_for_manager(request.user), many=True).data,
        )

    @extend_schema(request=InvitationSerializer, responses={201: InvitationSerializer})
    def post(self, request):
        serializer = InvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            invitation = create_invitation(
                actor=request.user, **serializer.validated_data
            )
        except SaasOperationError as exc:
            operation_error(exc)
        return success_response(
            "Invitation sent.",
            InvitationSerializer(invitation).data,
            status_code=status.HTTP_201_CREATED,
        )


class InvitationActionView(APIView):
    permission_classes = [IsOwner]
    action = "resend"

    @extend_schema(request=None, responses={200: InvitationSerializer})
    def post(self, request, invitation_id):
        invitation = get_object_or_404(
            invitations_for_manager(request.user), pk=invitation_id
        )
        try:
            invitation = (
                resend_invitation(actor=request.user, invitation=invitation)
                if self.action == "resend"
                else revoke_invitation(invitation=invitation)
            )
        except SaasOperationError as exc:
            operation_error(exc)
        return success_response(
            "Invitation resent." if self.action == "resend" else "Invitation revoked.",
            InvitationSerializer(invitation).data,
        )


class InvitationRevokeView(InvitationActionView):
    action = "revoke"


class SubscriptionView(APIView):
    permission_classes = [IsOwner]

    @extend_schema(responses={200: SubscriptionSerializer})
    def get(self, request):
        subscription = get_object_or_404(
            ShopSubscription.objects.select_related("plan"), shop=request.user.shop
        )
        data = SubscriptionSerializer(subscription).data
        data["usage"] = usage_for_shop(request.user.shop)
        data["is_primary_owner"] = user_is_primary_owner(request.user)
        return success_response("Subscription retrieved.", data)


class PlanListView(APIView):
    permission_classes = [IsOwner]

    @extend_schema(responses={200: PlanSerializer(many=True)})
    def get(self, request):
        return success_response(
            "Plans retrieved.", PlanSerializer(Plan.objects.filter(is_active=True), many=True).data
        )


class OnboardingView(APIView):
    permission_classes = [IsOwner]

    def _ensure_primary(self, request):
        if not user_is_primary_owner(request.user):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Primary owner access is required.")

    @extend_schema(responses={200: OnboardingSerializer})
    def get(self, request):
        self._ensure_primary(request)
        shop = request.user.shop
        data = {
            "current_step": shop.onboarding_current_step,
            "completed_at": shop.onboarding_completed_at,
            "status": shop.status,
            "name": shop.name,
            "legal_name": shop.legal_name,
            "address": shop.address,
            "city": shop.city,
            "phone": shop.phone,
            "default_tax_rate": shop.default_tax_rate,
            "tax_registration_number": shop.tax_registration_number,
            "receipt_footer": shop.receipt_footer,
        }
        return success_response("Onboarding retrieved.", data)

    @extend_schema(request=OnboardingSerializer, responses={200: OnboardingSerializer})
    @transaction.atomic
    def patch(self, request):
        self._ensure_primary(request)
        serializer = OnboardingSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        shop = request.user.shop
        values = dict(serializer.validated_data)
        next_step = values.pop("next_step", None)
        for field, value in values.items():
            setattr(shop, field, value)
        if next_step is not None:
            shop.onboarding_current_step = max(shop.onboarding_current_step, next_step)
        shop.full_clean()
        shop.save()
        return self.get(request)


class OnboardingCompleteView(APIView):
    permission_classes = [IsOwner]

    @extend_schema(request=None, responses={200: SuccessSerializer})
    def post(self, request):
        if not user_is_primary_owner(request.user):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Primary owner access is required.")
        shop = complete_onboarding(request.user.shop)
        _send_onboarding_complete(request.user)
        return success_response(
            "Onboarding completed.",
            {"status": shop.status, "completed_at": shop.onboarding_completed_at},
        )


def _send_onboarding_complete(user):
    from apps.saas.services import _send_action_email

    _send_action_email(
        subject="Welcome to NexaPOS",
        recipient=user.email,
        template="welcome",
        context={"name": user.full_name, "shop_name": user.shop.name},
    )
