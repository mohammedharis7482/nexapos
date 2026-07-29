from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .forms import UserChangeForm, UserCreationForm
from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    add_form = UserCreationForm
    form = UserChangeForm
    model = User

    list_display = (
        "username",
        "full_name",
        "shop",
        "role",
        "is_active",
        "is_staff",
    )
    list_filter = ("role", "is_active", "is_staff", "shop")
    search_fields = ("username", "full_name", "email", "shop__name")
    ordering = ("shop__name", "username")
    readonly_fields = (
        "last_login", "date_joined", "created_at", "updated_at", "created_by",
        "activated_at", "deactivated_at", "password_changed_at", "role_changed_at",
    )
    filter_horizontal = ("groups", "user_permissions")

    fieldsets = (
        (None, {"fields": ("shop", "username", "password")}),
        ("Personal details", {"fields": ("full_name", "email")}),
        ("Shop access", {"fields": ("role", "is_active", "must_change_password")}),
        (
            "Permissions",
            {
                "fields": (
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
        ("Audit", {"fields": (
            "created_by", "activated_at", "deactivated_at",
            "password_changed_at", "role_changed_at", "created_at", "updated_at",
        )}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "shop",
                    "username",
                    "full_name",
                    "email",
                    "role",
                    "password1",
                    "password2",
                    "is_active",
                    "is_staff",
                ),
            },
        ),
    )
