from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from uuid import UUID

from apps.accounts.models import User


class ShopSessionSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(read_only=True)
    currency = serializers.CharField(read_only=True)
    timezone = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    onboarding_completed = serializers.BooleanField(read_only=True)


class SubscriptionSessionSerializer(serializers.Serializer):
    status = serializers.CharField(read_only=True)
    plan_code = serializers.CharField(read_only=True)
    trial_ends_at = serializers.DateTimeField(read_only=True, allow_null=True)


class CapabilitiesSerializer(serializers.Serializer):
    manage_team = serializers.BooleanField(read_only=True)
    manage_owners = serializers.BooleanField(read_only=True)
    view_subscription = serializers.BooleanField(read_only=True)
    manage_subscription = serializers.BooleanField(read_only=True)


class UserSessionSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    full_name = serializers.CharField(read_only=True)
    username = serializers.CharField(read_only=True)
    email = serializers.EmailField(read_only=True, allow_blank=True)
    email_verified = serializers.BooleanField(read_only=True)
    email_verification_required = serializers.BooleanField(read_only=True)
    last_login = serializers.DateTimeField(read_only=True, allow_null=True)
    role = serializers.ChoiceField(choices=User.Role.choices, read_only=True)
    is_primary_owner = serializers.BooleanField(read_only=True)
    shop = ShopSessionSerializer(read_only=True)
    subscription = SubscriptionSessionSerializer(read_only=True, allow_null=True)
    capabilities = CapabilitiesSerializer(read_only=True)


class SessionDataSerializer(serializers.Serializer):
    user = UserSessionSerializer(read_only=True)


class SuccessSerializer(serializers.Serializer):
    success = serializers.BooleanField(read_only=True)
    message = serializers.CharField(read_only=True)
    data = SessionDataSerializer(read_only=True, allow_null=True)


class LoginErrorSerializer(serializers.Serializer):
    success = serializers.BooleanField(read_only=True)
    message = serializers.CharField(read_only=True)
    code = serializers.ChoiceField(
        choices=(
            "INVALID_CREDENTIALS",
            "EMAIL_NOT_VERIFIED",
            "USER_INACTIVE",
            "SHOP_SUSPENDED",
            "SHOP_CANCELLED",
        ),
        read_only=True,
    )
    errors = serializers.DictField(read_only=True)


class LoginSerializer(serializers.Serializer):
    shop_id = serializers.CharField(max_length=36, trim_whitespace=True)
    username = serializers.CharField(max_length=150, trim_whitespace=True)
    password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        style={"input_type": "password"},
    )

    def validate_shop_id(self, value: str):
        try:
            return UUID(value)
        except (ValueError, AttributeError) as exc:
            raise serializers.ValidationError("Enter a valid Shop ID.") from exc


class ResendVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False, write_only=True)
    shop_id = serializers.CharField(
        required=False, write_only=True, max_length=36, trim_whitespace=True
    )
    username = serializers.CharField(
        required=False, write_only=True, max_length=150, trim_whitespace=True
    )

    def validate(self, attrs):
        has_email = bool(attrs.get("email"))
        has_login_context = bool(attrs.get("shop_id") and attrs.get("username"))
        if not has_email and not has_login_context:
            raise serializers.ValidationError(
                {"detail": "Provide an email or Shop ID and username."}
            )
        if attrs.get("shop_id"):
            try:
                attrs["shop_id"] = UUID(attrs["shop_id"])
            except (ValueError, AttributeError) as exc:
                raise serializers.ValidationError(
                    {"shop_id": "Enter a valid Shop ID."}
                ) from exc
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(
        write_only=True, trim_whitespace=False, style={"input_type": "password"}
    )
    new_password = serializers.CharField(
        write_only=True, trim_whitespace=False, style={"input_type": "password"}
    )
    confirm_password = serializers.CharField(
        write_only=True, trim_whitespace=False, style={"input_type": "password"}
    )

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": ["The new passwords do not match."]}
            )
        return attrs

    @staticmethod
    def convert_django_validation_error(exc: DjangoValidationError):
        if hasattr(exc, "message_dict"):
            raise serializers.ValidationError(exc.message_dict)
        raise serializers.ValidationError({"new_password": list(exc.messages)})


class AccountProfileSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField(allow_blank=True)
    username = serializers.CharField(read_only=True)
    role = serializers.CharField(read_only=True)
    shop_name = serializers.CharField(read_only=True)
    last_login = serializers.DateTimeField(read_only=True, allow_null=True)
