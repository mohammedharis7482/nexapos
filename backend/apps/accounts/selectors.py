from .models import User


def user_session_data(user: User) -> dict:
    """Return the single safe user representation exposed to the frontend."""

    return {
        "user": {
            "id": str(user.id),
            "full_name": user.full_name,
            "username": user.username,
            "role": user.role,
            "shop": {
                "id": str(user.shop_id),
                "name": user.shop.name,
                "currency": user.shop.currency,
                "timezone": user.shop.timezone,
            },
        }
    }
