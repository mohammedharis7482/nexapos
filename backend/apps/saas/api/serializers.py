from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field

from apps.accounts.models import User
from apps.saas.models import Plan, ShopInvitation, ShopSubscription


class PasswordConfirmMixin:
    """Rejects a payload whose confirmation field doesn't match its
    password field, then drops the confirmation field from validated_data.

    Subclasses set password_field/confirm_field since the two fields are
    named differently across serializers (password/password_confirm,
    temporary_password/temporary_password_confirm, new_password/
    confirm_password).
    """

    password_field = "password"
    confirm_field = "password_confirm"

    def validate(self, attrs):
        if attrs[self.password_field] != attrs.pop(self.confirm_field):
            raise serializers.ValidationError(
                {self.confirm_field: "Passwords do not match."}
            )
        return attrs


class RegistrationSerializer(PasswordConfirmMixin, serializers.Serializer):
    shop_name = serializers.CharField(max_length=150)
    owner_full_name = serializers.CharField(max_length=150)
    owner_email = serializers.EmailField()
    owner_username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)
    address = serializers.CharField(max_length=500)
    phone = serializers.CharField(max_length=30)
    country = serializers.ChoiceField(choices=["Qatar"], default="Qatar")
    timezone = serializers.ChoiceField(choices=["Asia/Qatar"], default="Asia/Qatar")
    currency = serializers.ChoiceField(choices=["QAR"], default="QAR")


class PublicShopIdentitySerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(read_only=True)


class PublicOwnerIdentitySerializer(serializers.Serializer):
    username = serializers.CharField(read_only=True)


class RegistrationDataSerializer(serializers.Serializer):
    shop = PublicShopIdentitySerializer(read_only=True)
    owner = PublicOwnerIdentitySerializer(read_only=True)
    verification_required = serializers.BooleanField(read_only=True)
    owner_email = serializers.EmailField(read_only=True)
    registration_status = serializers.CharField(read_only=True)
    email_delivery = serializers.CharField(read_only=True)
    next_step = serializers.ChoiceField(
        choices=("SIGN_IN", "VERIFY_EMAIL"), read_only=True
    )


class RegistrationResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField(read_only=True)
    message = serializers.CharField(read_only=True)
    data = RegistrationDataSerializer(read_only=True)


class RegistrationErrorSerializer(serializers.Serializer):
    success = serializers.BooleanField(read_only=True)
    message = serializers.CharField(read_only=True)
    errors = serializers.DictField(read_only=True)


class VerificationDataSerializer(serializers.Serializer):
    shop = PublicShopIdentitySerializer(read_only=True)


class VerificationResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField(read_only=True)
    message = serializers.CharField(read_only=True)
    data = VerificationDataSerializer(read_only=True)


class TokenSerializer(serializers.Serializer):
    token = serializers.CharField(write_only=True, min_length=20, max_length=200)


class EmailSerializer(serializers.Serializer):
    email = serializers.EmailField(write_only=True)


class InvitationSerializer(serializers.ModelSerializer):
    invited_by_name = serializers.CharField(source="invited_by.full_name", read_only=True)
    status = serializers.SerializerMethodField()

    class Meta:
        model = ShopInvitation
        fields = (
            "id",
            "email",
            "full_name",
            "role",
            "invited_by_name",
            "expires_at",
            "status",
            "created_at",
        )
        read_only_fields = (
            "id",
            "invited_by_name",
            "expires_at",
            "status",
            "created_at",
        )

    @extend_schema_field(serializers.CharField())
    def get_status(self, invitation) -> str:
        if invitation.accepted_at:
            return "ACCEPTED"
        if invitation.revoked_at:
            return "REVOKED"
        from django.utils import timezone

        return "EXPIRED" if invitation.expires_at <= timezone.now() else "PENDING"


class InvitationContextSerializer(serializers.Serializer):
    shop_name = serializers.CharField(read_only=True)
    email = serializers.EmailField(read_only=True)
    role = serializers.CharField(read_only=True)
    inviter_name = serializers.CharField(read_only=True)
    expires_at = serializers.DateTimeField(read_only=True)


class AcceptInvitationSerializer(PasswordConfirmMixin, TokenSerializer):
    full_name = serializers.CharField(max_length=150)
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)


class ManagedUserSerializer(serializers.ModelSerializer):
    is_primary_owner = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(
        source="created_by.full_name", read_only=True, default=None
    )
    available_actions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "full_name",
            "username",
            "email",
            "role",
            "is_primary_owner",
            "is_active",
            "must_change_password",
            "status",
            "last_login",
            "date_joined",
            "created_at",
            "created_by_name",
            "available_actions",
        )
        read_only_fields = fields

    @extend_schema_field(serializers.BooleanField())
    def get_is_primary_owner(self, user) -> bool:
        return user.shop.primary_owner_id == user.id

    @extend_schema_field(serializers.CharField())
    def get_status(self, user) -> str:
        if user.must_change_password and user.is_active:
            return "PASSWORD_CHANGE_REQUIRED"
        return "ACTIVE" if user.is_active else "INACTIVE"

    @extend_schema_field(serializers.ListField(child=serializers.CharField()))
    def get_available_actions(self, user) -> list[str]:
        request = self.context.get("request")
        actor = getattr(request, "user", None)
        if not actor or user.id == actor.id or user.shop.primary_owner_id == user.id:
            return ["edit"] if actor and user.id == actor.id else []
        if user.role == User.Role.OWNER and user.shop.primary_owner_id != actor.id:
            return []
        actions = ["edit", "change_role", "reset_password"]
        actions.append("deactivate" if user.is_active else "activate")
        return actions


class StaffCreateSerializer(PasswordConfirmMixin, serializers.Serializer):
    password_field = "temporary_password"
    confirm_field = "temporary_password_confirm"

    full_name = serializers.CharField(max_length=150)
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=User.Role.choices)
    temporary_password = serializers.CharField(write_only=True, trim_whitespace=False)
    temporary_password_confirm = serializers.CharField(
        write_only=True, trim_whitespace=False
    )


class StaffPasswordResetSerializer(PasswordConfirmMixin, serializers.Serializer):
    password_field = "temporary_password"
    confirm_field = "temporary_password_confirm"

    temporary_password = serializers.CharField(write_only=True, trim_whitespace=False)
    temporary_password_confirm = serializers.CharField(
        write_only=True, trim_whitespace=False
    )


class UserUpdateSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150, required=False)
    email = serializers.EmailField(required=False, allow_blank=True)


class RoleChangeSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=User.Role.choices)


class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = (
            "code",
            "name",
            "description",
            "monthly_price",
            "yearly_price",
            "currency",
            "trial_days",
            "max_users",
            "max_products",
            "reports_enabled",
            "advanced_reports_enabled",
        )


class SubscriptionSerializer(serializers.ModelSerializer):
    plan = PlanSerializer(read_only=True)
    usage = serializers.DictField(read_only=True)

    class Meta:
        model = ShopSubscription
        fields = (
            "status",
            "trial_started_at",
            "trial_ends_at",
            "current_period_start",
            "current_period_end",
            "grace_period_ends_at",
            "plan",
            "usage",
        )


class OnboardingSerializer(serializers.Serializer):
    current_step = serializers.IntegerField(read_only=True)
    completed_at = serializers.DateTimeField(read_only=True, allow_null=True)
    status = serializers.CharField(read_only=True)
    name = serializers.CharField(max_length=150, required=False)
    legal_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    address = serializers.CharField(required=False)
    city = serializers.CharField(max_length=100, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=30, required=False)
    default_tax_rate = serializers.DecimalField(
        max_digits=5, decimal_places=2, min_value=0, max_value=100, required=False
    )
    tax_registration_number = serializers.CharField(
        max_length=50, required=False, allow_blank=True
    )
    receipt_footer = serializers.CharField(required=False, allow_blank=True)
    next_step = serializers.IntegerField(min_value=1, max_value=7, required=False)


class PasswordResetConfirmSerializer(PasswordConfirmMixin, TokenSerializer):
    password_field = "new_password"
    confirm_field = "confirm_password"

    new_password = serializers.CharField(write_only=True, trim_whitespace=False)
    confirm_password = serializers.CharField(write_only=True, trim_whitespace=False)
