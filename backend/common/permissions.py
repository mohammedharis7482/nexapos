from rest_framework.permissions import BasePermission
from rest_framework.permissions import SAFE_METHODS

from apps.shops.models import Shop


def tenant_access_allowed(user, method: str) -> bool:
    """Central tenant lifecycle policy for established business APIs."""

    if not user or not user.is_authenticated or not user.is_active:
        return False
    shop = user.shop
    if not shop.is_active or shop.status == Shop.Status.CANCELLED:
        return False
    if method in SAFE_METHODS:
        return shop.status != Shop.Status.PENDING_VERIFICATION
    return shop.status in (
        Shop.Status.ONBOARDING,
        Shop.Status.TRIAL,
        Shop.Status.ACTIVE,
        Shop.Status.PAST_DUE,
    )


class IsOwner(BasePermission):
    """Allow access only to active users assigned the owner role."""

    message = "Owner access is required."

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and tenant_access_allowed(user, request.method)
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
            and tenant_access_allowed(user, request.method)
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
        return bool(
            user
            and user.is_authenticated
            and tenant_access_allowed(user, request.method)
        )

    def has_object_permission(self, request, view, obj) -> bool:
        user = request.user
        object_shop_id = getattr(obj, "shop_id", None)
        if object_shop_id is None and obj.__class__.__name__ == "Shop":
            object_shop_id = obj.pk
        return object_shop_id == user.shop_id
