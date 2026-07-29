from django.contrib.auth import logout
from django.core.exceptions import ValidationError as DjangoValidationError
from django.conf import settings
from django.middleware.csrf import get_token
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.accounts.selectors import user_session_data
from apps.accounts.services import change_user_password, login_user
from apps.saas.services import create_verification_token, invalidate_user_sessions
from common.authentication import ApiSessionAuthentication, enforce_csrf
from common.throttling import LoginContextThrottle, LoginIpThrottle
from common.views import success_response

from .serializers import (
    ChangePasswordSerializer,
    LoginErrorSerializer,
    LoginSerializer,
    SuccessSerializer,
    AccountProfileSerializer,
)


class CsrfView(APIView):
    authentication_classes: list = []
    permission_classes = [AllowAny]

    @extend_schema(responses={200: SuccessSerializer})
    def get(self, request):
        get_token(request)
        return success_response("CSRF cookie initialized.")


class LoginView(APIView):
    authentication_classes = [ApiSessionAuthentication]
    permission_classes = [AllowAny]
    throttle_classes = [LoginIpThrottle, LoginContextThrottle]

    @extend_schema(
        request=LoginSerializer,
        responses={
            200: SuccessSerializer,
            401: LoginErrorSerializer,
            403: LoginErrorSerializer,
        },
    )
    def post(self, request):
        enforce_csrf(request)
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = login_user(request=request, **serializer.validated_data)
        return success_response("Login successful.", user_session_data(user))


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={200: SuccessSerializer})
    def post(self, request):
        from apps.saas.models import AuditEvent

        user = request.user
        AuditEvent.objects.create(
            shop=user.shop,
            actor=user,
            target_user=user,
            event=AuditEvent.Event.USER_LOGOUT,
        )
        logout(request)
        return success_response("Logout successful.")


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: SuccessSerializer})
    def get(self, request):
        return success_response(
            "Current user retrieved.",
            user_session_data(request.user),
        )


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=ChangePasswordSerializer,
        responses={200: SuccessSerializer},
    )
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            change_user_password(
                request=request,
                user=request.user,
                current_password=serializer.validated_data["current_password"],
                new_password=serializer.validated_data["new_password"],
            )
        except DjangoValidationError as exc:
            ChangePasswordSerializer.convert_django_validation_error(exc)
        return success_response("Password changed successfully.")


class AccountProfileView(APIView):
    permission_classes = [IsAuthenticated]

    @staticmethod
    def data(user):
        return {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "username": user.username,
            "role": user.role,
            "shop_name": user.shop.name,
            "last_login": user.last_login,
        }

    @extend_schema(responses={200: AccountProfileSerializer})
    def get(self, request):
        return success_response("Account retrieved.", self.data(request.user))

    @extend_schema(
        request=AccountProfileSerializer, responses={200: AccountProfileSerializer}
    )
    def patch(self, request):
        serializer = AccountProfileSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = request.user
        old_email = user.email
        user.full_name = serializer.validated_data.get("full_name", user.full_name).strip()
        user.email = serializer.validated_data.get("email", user.email).strip()
        if user.email.lower() != old_email.lower():
            user.email_verified_at = (
                None if settings.REQUIRE_EMAIL_VERIFICATION else timezone.now()
            )
        user.full_clean(exclude=["password"])
        user.save()
        if (
            settings.REQUIRE_EMAIL_VERIFICATION
            and user.email
            and user.email_verified_at is None
        ):
            create_verification_token(user)
        return success_response("Account updated.", self.data(user))


class LogoutAllView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={200: SuccessSerializer})
    def post(self, request):
        invalidate_user_sessions(request.user)
        return success_response("All sessions logged out.")
