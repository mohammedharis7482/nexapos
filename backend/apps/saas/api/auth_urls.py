from django.urls import path

from .views import (
    PasswordResetConfirmView,
    PasswordResetRequestView,
    ResendVerificationView,
    VerifyEmailView,
)

urlpatterns = [
    path("email-verification/resend/", ResendVerificationView.as_view(), name="verification-resend"),
    path("email-verification/verify/", VerifyEmailView.as_view(), name="verification-verify"),
    path("password-reset/request/", PasswordResetRequestView.as_view(), name="password-reset-request"),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
]
