from decimal import Decimal

from rest_framework import serializers

from apps.sales.models import Sale, SaleItem


class SaleCreatorSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    full_name = serializers.CharField(read_only=True)
    role = serializers.CharField(read_only=True)


class SaleItemProductSerializer(serializers.Serializer):
    id = serializers.UUIDField(source="product_id", read_only=True)
    name = serializers.CharField(source="product_name", read_only=True)
    sku = serializers.CharField(read_only=True)
    barcode = serializers.CharField(read_only=True, allow_null=True)
    unit = serializers.CharField(read_only=True)


class SaleItemSerializer(serializers.ModelSerializer):
    product = SaleItemProductSerializer(source="*", read_only=True)

    class Meta:
        model = SaleItem
        fields = (
            "id",
            "product",
            "quantity",
            "unit_price",
            "tax_rate",
            "is_tax_inclusive",
            "tax_amount",
            "line_subtotal",
            "line_total",
        )


class DraftSaleSerializer(serializers.ModelSerializer):
    currency = serializers.CharField(source="shop.currency", read_only=True)
    created_by = SaleCreatorSerializer(read_only=True)
    cancelled_by = SaleCreatorSerializer(read_only=True)
    items = SaleItemSerializer(many=True, read_only=True)

    class Meta:
        model = Sale
        fields = (
            "id",
            "status",
            "currency",
            "created_by",
            "items",
            "subtotal",
            "tax_total",
            "discount_total",
            "grand_total",
            "notes",
            "cancelled_at",
            "cancelled_by",
            "created_at",
            "updated_at",
        )


class CreateDraftSerializer(serializers.Serializer):
    notes = serializers.CharField(required=False, allow_blank=True, max_length=1000)

    def validate(self, attrs):
        prohibited = {
            "shop",
            "shop_id",
            "created_by",
            "subtotal",
            "tax_total",
            "discount_total",
            "grand_total",
            "status",
        }
        supplied = prohibited.intersection(self.initial_data)
        if supplied:
            raise serializers.ValidationError(
                {field: "This field cannot be supplied." for field in supplied}
            )
        return attrs


class AddItemSerializer(serializers.Serializer):
    product_id = serializers.UUIDField(required=False)
    barcode = serializers.CharField(required=False, max_length=80)
    quantity = serializers.DecimalField(
        max_digits=15,
        decimal_places=3,
        min_value=Decimal("0.001"),
    )

    def validate(self, attrs):
        has_product = bool(attrs.get("product_id"))
        has_barcode = bool(attrs.get("barcode", "").strip())
        if has_product == has_barcode:
            raise serializers.ValidationError(
                "Supply exactly one of product_id or barcode."
            )
        prohibited = {
            "shop",
            "shop_id",
            "created_by",
            "unit_price",
            "tax_rate",
            "tax_amount",
            "subtotal",
            "line_subtotal",
            "line_total",
        }
        supplied = prohibited.intersection(self.initial_data)
        if supplied:
            raise serializers.ValidationError(
                {field: "This field cannot be supplied." for field in supplied}
            )
        if "barcode" in attrs:
            attrs["barcode"] = attrs["barcode"].strip()
        return attrs


class UpdateItemSerializer(serializers.Serializer):
    quantity = serializers.DecimalField(
        max_digits=15,
        decimal_places=3,
        min_value=Decimal("0.001"),
    )

    def validate(self, attrs):
        if set(self.initial_data) != {"quantity"}:
            extra = set(self.initial_data) - {"quantity"}
            if extra:
                raise serializers.ValidationError(
                    {field: "This field cannot be supplied." for field in extra}
                )
        return attrs
