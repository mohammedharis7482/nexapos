from rest_framework.permissions import BasePermission


class IsOwner(BasePermission):
    """Allow access only to active users assigned the owner role."""

    message = "Owner access is required."

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.is_active
            and user.role == user.Role.OWNER
        )
