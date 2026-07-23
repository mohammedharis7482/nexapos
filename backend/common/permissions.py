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
            and (user.is_superuser or user.role == user.Role.OWNER)
        )


class IsCashierOrOwner(BasePermission):
    """Allow active owners and cashiers; superusers are owner-equivalent."""

    message = "Shop staff access is required."

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.is_active
            and (
                user.is_superuser
                or user.role in (user.Role.OWNER, user.Role.CASHIER)
            )
        )


class IsSameShop(BasePermission):
    """Enforce the authenticated user's shop as the API isolation boundary."""

    message = "You do not have access to this shop's data."

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(user and user.is_authenticated and user.is_active)

    def has_object_permission(self, request, view, obj) -> bool:
        user = request.user
        object_shop_id = getattr(obj, "shop_id", None)
        if object_shop_id is None and obj.__class__.__name__ == "Shop":
            object_shop_id = obj.pk
        return object_shop_id == user.shop_id
