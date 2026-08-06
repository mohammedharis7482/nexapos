from datetime import datetime
from decimal import Decimal

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.inventory.models import InventoryBalance, StockMovement
from apps.inventory.selectors import stock_status_for
from apps.products.api.serializers import product_image_url
from apps.products.models import Product, ProductCategory, ProductPacket


class InventoryCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductCategory
        fields = ("id", "name")


class InventoryPacketSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductPacket
        fields = ("id", "size", "price")


class InventoryProductSerializer(serializers.ModelSerializer):
    category = InventoryCategorySerializer(read_only=True)
    image_url = serializers.SerializerMethodField()
    # The billing grid needs the packet offer to render its size selector.
    # Inactive packets are withheld: they exist only so sale history keeps
    # resolving, and must never be sellable again.
    packets = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            "id",
            "name",
            "sku",
            "barcode",
            "unit",
            "selling_price",
            "category",
            "is_active",
            "image_url",
            "pricing_mode",
            "packets",
        )

    @extend_schema_field(InventoryPacketSerializer(many=True))
    def get_packets(self, product) -> list:
        return InventoryPacketSerializer(
            [packet for packet in product.packets.all() if packet.is_active],
            many=True,
        ).data

    def get_image_url(self, product) -> str | None:
        return product_image_url(product, self.context.get("request"))




class InventoryItemSerializer(serializers.Serializer):
    product = InventoryProductSerializer(source="*", read_only=True)
    quantity_on_hand = serializers.SerializerMethodField()
    low_stock_threshold = serializers.SerializerMethodField()
    stock_status = serializers.SerializerMethodField()
    last_movement_at = serializers.SerializerMethodField()
    is_initialized = serializers.SerializerMethodField()

    @staticmethod
    def _balance(product: Product) -> InventoryBalance | None:
        try:
            return product.inventory_balance
        except InventoryBalance.DoesNotExist:
            return None

    def get_quantity_on_hand(self, product: Product) -> str | None:
        balance = self._balance(product)
        return f"{balance.quantity_on_hand:.3f}" if balance else None

    def get_low_stock_threshold(self, product: Product) -> str | None:
        balance = self._balance(product)
        return f"{balance.low_stock_threshold:.3f}" if balance else None

    def get_stock_status(self, product: Product) -> str:
        return stock_status_for(self._balance(product))

    def get_last_movement_at(self, product: Product) -> datetime | None:
        balance = self._balance(product)
        return balance.last_movement_at if balance else None

    def get_is_initialized(self, product: Product) -> bool:
        return self._balance(product) is not None


class MovementUserSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    full_name = serializers.CharField(read_only=True)


class StockMovementSerializer(serializers.ModelSerializer):
    created_by = MovementUserSerializer(read_only=True)

    class Meta:
        model = StockMovement
        fields = (
            "id",
            "movement_type",
            "quantity_delta",
            "quantity_before",
            "quantity_after",
            "reason",
            "reference",
            "created_by",
            "created_at",
        )


class OpeningStockSerializer(serializers.Serializer):
    quantity = serializers.DecimalField(max_digits=15, decimal_places=3, min_value=0)
    low_stock_threshold = serializers.DecimalField(
        max_digits=15,
        decimal_places=3,
        min_value=0,
    )
    reason = serializers.CharField(required=False, allow_blank=True, max_length=500)

    def validate(self, attrs):
        prohibited = {"shop", "shop_id", "created_by", "quantity_after"}
        supplied = prohibited.intersection(self.initial_data)
        if supplied:
            raise serializers.ValidationError(
                {field: "This field cannot be supplied." for field in supplied}
            )
        return attrs


class AdjustmentSerializer(serializers.Serializer):
    movement_type = serializers.ChoiceField(
        choices=[
            choice
            for choice in StockMovement.Type.choices
            if choice[0] != StockMovement.Type.OPENING
        ]
    )
    quantity = serializers.DecimalField(
        max_digits=15,
        decimal_places=3,
        min_value=Decimal("0.001"),
    )
    reason = serializers.CharField(required=False, allow_blank=True, max_length=500)
    reference = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=120,
    )

    def validate(self, attrs):
        prohibited = {
            "shop",
            "shop_id",
            "created_by",
            "quantity_delta",
            "quantity_before",
            "quantity_after",
        }
        supplied = prohibited.intersection(self.initial_data)
        if supplied:
            raise serializers.ValidationError(
                {field: "This field cannot be supplied." for field in supplied}
            )
        return attrs


class ThresholdSerializer(serializers.Serializer):
    low_stock_threshold = serializers.DecimalField(
        max_digits=15,
        decimal_places=3,
        min_value=0,
    )

    def validate(self, attrs):
        prohibited = {"shop", "shop_id", "product", "product_id", "quantity_on_hand"}
        supplied = prohibited.intersection(self.initial_data)
        if supplied:
            raise serializers.ValidationError(
                {field: "This field cannot be supplied." for field in supplied}
            )
        return attrs


class InventoryOperationResponseSerializer(serializers.Serializer):
    inventory = InventoryItemSerializer(read_only=True)
    movement = StockMovementSerializer(read_only=True)


class InventorySummarySerializer(serializers.Serializer):
    total_products = serializers.IntegerField(read_only=True)
    initialized = serializers.IntegerField(read_only=True)
    low_stock = serializers.IntegerField(read_only=True)
    out_of_stock = serializers.IntegerField(read_only=True)
