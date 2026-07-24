from decimal import Decimal

from rest_framework import serializers

from apps.payments.models import Payment
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


class PaymentInputSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=Payment.Method.choices)
    amount = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        min_value=Decimal("0.01"),
    )
    reference = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=120,
    )

    def validate(self, attrs):
        if attrs["method"] == Payment.Method.CASH and attrs.get("reference"):
            raise serializers.ValidationError(
                {"reference": "References are only used for card payments."}
            )
        return attrs


class CompleteSaleRequestSerializer(serializers.Serializer):
    payments = PaymentInputSerializer(many=True, min_length=1, max_length=2)
    amount_received = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        min_value=Decimal("0.01"),
        required=False,
        allow_null=True,
    )

    def validate(self, attrs):
        prohibited = {
            "shop",
            "shop_id",
            "sale_number",
            "grand_total",
            "change_due",
            "completed_by",
            "payment_status",
            "inventory",
            "line_totals",
        }
        supplied = prohibited.intersection(self.initial_data)
        if supplied:
            raise serializers.ValidationError(
                {field: "This field cannot be supplied." for field in supplied}
            )
        methods = [payment["method"] for payment in attrs["payments"]]
        if len(methods) != len(set(methods)):
            raise serializers.ValidationError(
                {"payments": "Each payment method may appear only once."}
            )
        return attrs


class PaymentSummarySerializer(serializers.ModelSerializer):
    method = serializers.CharField(source="payment_method")

    class Meta:
        model = Payment
        fields = ("id", "method", "amount", "reference", "created_at")


class CompletedSaleSerializer(DraftSaleSerializer):
    completed_by = SaleCreatorSerializer(read_only=True)
    payments = PaymentSummarySerializer(many=True, read_only=True)

    class Meta(DraftSaleSerializer.Meta):
        fields = DraftSaleSerializer.Meta.fields + (
            "sale_number",
            "completed_by",
            "payments",
            "amount_received",
            "change_due",
            "completed_at",
        )


class SaleHistorySerializer(serializers.ModelSerializer):
    currency = serializers.CharField(source="shop.currency", read_only=True)
    cashier = SaleCreatorSerializer(source="created_by", read_only=True)
    item_count = serializers.SerializerMethodField()
    payment_methods = serializers.SerializerMethodField()

    class Meta:
        model = Sale
        fields = (
            "id",
            "sale_number",
            "status",
            "currency",
            "cashier",
            "item_count",
            "payment_methods",
            "grand_total",
            "completed_at",
        )

    def get_item_count(self, sale: Sale) -> int:
        return len(sale.items.all())

    def get_payment_methods(self, sale: Sale) -> list[str]:
        return [payment.payment_method for payment in sale.payments.all()]


class ReceiptShopSerializer(serializers.Serializer):
    name = serializers.CharField()
    legal_name = serializers.CharField()
    address = serializers.CharField()
    phone = serializers.CharField()
    tax_registration_number = serializers.CharField()
    receipt_footer = serializers.CharField()


class ReceiptDataSerializer(serializers.Serializer):
    shop = ReceiptShopSerializer()
    sale = CompletedSaleSerializer()


class CashierFilterSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    full_name = serializers.CharField()
    role = serializers.CharField()


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
