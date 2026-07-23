from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.accounts.models import User


class ShopSessionSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(read_only=True)
    currency = serializers.CharField(read_only=True)
    timezone = serializers.CharField(read_only=True)


class UserSessionSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    full_name = serializers.CharField(read_only=True)
    username = serializers.CharField(read_only=True)
    role = serializers.ChoiceField(choices=User.Role.choices, read_only=True)
    shop = ShopSessionSerializer(read_only=True)


class SessionDataSerializer(serializers.Serializer):
    user = UserSessionSerializer(read_only=True)


class SuccessSerializer(serializers.Serializer):
    success = serializers.BooleanField(read_only=True)
    message = serializers.CharField(read_only=True)
    data = SessionDataSerializer(read_only=True, allow_null=True)


class LoginSerializer(serializers.Serializer):
    shop_id = serializers.UUIDField()
    username = serializers.CharField(max_length=150, trim_whitespace=True)
    password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        style={"input_type": "password"},
    )


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
