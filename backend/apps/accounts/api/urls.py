from django.urls import path

from .views import (
    AccountProfileView,
    ChangePasswordView,
    CsrfView,
    LoginView,
    LogoutAllView,
    LogoutView,
    MeView,
)

app_name = "accounts_api"

urlpatterns = [
    path("csrf/", CsrfView.as_view(), name="csrf"),
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", MeView.as_view(), name="me"),
    path("change-password/", ChangePasswordView.as_view(), name="change-password"),
    path("account/", AccountProfileView.as_view(), name="account"),
    path("logout-all/", LogoutAllView.as_view(), name="logout-all"),
]
