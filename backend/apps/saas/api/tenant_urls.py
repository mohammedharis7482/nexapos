from django.urls import path

from .views import (
    InvitationAcceptView,
    InvitationActionView,
    InvitationListCreateView,
    InvitationRevokeView,
    UserActivationView,
    UserDeactivateView,
    UserDetailView,
    UserListView,
    UserRoleView,
)

urlpatterns = [
    path("users/", UserListView.as_view(), name="users"),
    path("users/<uuid:user_id>/", UserDetailView.as_view(), name="user-detail"),
    path("users/<uuid:user_id>/activate/", UserActivationView.as_view(), name="user-activate"),
    path("users/<uuid:user_id>/deactivate/", UserDeactivateView.as_view(), name="user-deactivate"),
    path("users/<uuid:user_id>/change-role/", UserRoleView.as_view(), name="user-role"),
    path("users/invitations/", InvitationListCreateView.as_view(), name="invitations"),
    path(
        "users/invitations/<uuid:invitation_id>/resend/",
        InvitationActionView.as_view(),
        name="invitation-resend",
    ),
    path(
        "users/invitations/<uuid:invitation_id>/revoke/",
        InvitationRevokeView.as_view(),
        name="invitation-revoke",
    ),
    path("invitations/accept/", InvitationAcceptView.as_view(), name="invitation-accept"),
]
