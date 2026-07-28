from apps.accounts.models import User

from .models import ShopInvitation


def users_for_manager(user: User):
    return User.objects.filter(shop=user.shop).select_related("shop").order_by(
        "-is_active", "full_name", "username"
    )


def invitations_for_manager(user: User):
    return ShopInvitation.objects.filter(shop=user.shop).select_related(
        "invited_by", "shop"
    )
