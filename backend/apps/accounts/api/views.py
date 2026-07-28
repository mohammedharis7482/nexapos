from django.contrib.auth import logout
from django.core.exceptions import ValidationError as DjangoValidationError
from django.middleware.csrf import get_token
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.accounts.selectors import user_session_data
from apps.accounts.services import change_user_password, login_user
from common.authentication import ApiSessionAuthentication, enforce_csrf
from common.throttling import LoginContextThrottle, LoginIpThrottle
from common.views import success_response

from .serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    SuccessSerializer,
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

    @extend_schema(request=LoginSerializer, responses={200: SuccessSerializer})
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
