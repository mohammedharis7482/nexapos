from decimal import Decimal

from rest_framework import serializers

from apps.shops.models import Shop


class ShopSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shop
        fields = (
            "name",
            "legal_name",
            "phone",
            "email",
            "address",
            "city",
            "country",
            "currency",
            "timezone",
            "tax_registration_number",
            "default_tax_rate",
            "receipt_footer",
            "logo",
            "is_active",
        )
        read_only_fields = ("logo", "is_active")

    def validate_name(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Shop name cannot be empty.")
        return value

    def validate_country(self, value: str) -> str:
        if value.strip().lower() != "qatar":
            raise serializers.ValidationError("Country must be Qatar.")
        return "Qatar"

    def validate_currency(self, value: str) -> str:
        if value.strip().upper() != "QAR":
            raise serializers.ValidationError("Currency must be QAR.")
        return "QAR"

    def validate_timezone(self, value: str) -> str:
        if value.strip() != "Asia/Qatar":
            raise serializers.ValidationError("Timezone must be Asia/Qatar.")
        return "Asia/Qatar"

    def validate_default_tax_rate(self, value: Decimal) -> Decimal:
        if value < 0 or value > 100:
            raise serializers.ValidationError(
                "Default tax rate must be between 0 and 100."
            )
        return value

    def validate(self, attrs):
        if "shop" in self.initial_data or "shop_id" in self.initial_data:
            raise serializers.ValidationError(
                {"shop_id": "Shop cannot be changed through this endpoint."}
            )
        return attrs
