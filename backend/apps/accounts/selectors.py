from .models import User


def user_session_data(user: User) -> dict:
    """Return the single safe user representation exposed to the frontend."""

    shop = user.shop
    subscription = getattr(shop, "subscription", None)
    return {
        "user": {
            "id": str(user.id),
            "full_name": user.full_name,
            "username": user.username,
            "role": user.role,
            "email": user.email,
            "last_login": user.last_login,
            "is_primary_owner": shop.primary_owner_id == user.id,
            "shop": {
                "id": str(user.shop_id),
                "name": user.shop.name,
                "currency": user.shop.currency,
                "timezone": user.shop.timezone,
                "status": shop.status,
                "onboarding_completed": shop.onboarding_completed_at is not None,
            },
            "subscription": (
                {
                    "status": subscription.status,
                    "plan_code": subscription.plan.code,
                    "trial_ends_at": subscription.trial_ends_at,
                }
                if subscription
                else None
            ),
            "capabilities": {
                "manage_team": user.role == User.Role.OWNER,
                "manage_owners": shop.primary_owner_id == user.id,
                "view_subscription": user.role == User.Role.OWNER,
                "manage_subscription": shop.primary_owner_id == user.id,
            },
        }
    }
