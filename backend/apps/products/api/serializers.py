from decimal import Decimal

from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.products.image_rules import (
    ALLOWED_PRODUCT_IMAGE_FORMATS,
    MAX_PRODUCT_IMAGE_BYTES,
)
from apps.products.import_services import MAX_IMPORT_BYTES
from apps.products.models import (
    Product,
    ProductCategory,
    ProductImport,
    ProductImportRow,
    ProductPacket,
)


class CategorySummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductCategory
        fields = ("id", "name", "secondary_name")


class ProductCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductCategory
        fields = (
            "id",
            "name",
            "secondary_name",
            "description",
            "display_order",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_name(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Category name cannot be empty.")

        request = self.context["request"]
        queryset = ProductCategory.objects.filter(
            shop=request.user.shop,
            name__iexact=value,
        )
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError(
                "A category with this name already exists."
            )
        return value

    def validate(self, attrs):
        if "shop" in self.initial_data or "shop_id" in self.initial_data:
            raise serializers.ValidationError(
                {"shop_id": "Shop cannot be supplied."}
            )
        return attrs


def product_image_url(product, request=None) -> str | None:
    """Absolute URL for a product image, or None when there is no image.

    Reads only `field.url`, so a cloud storage backend returning a fully
    qualified URL passes through untouched (build_absolute_uri is a no-op on
    an absolute URL).
    """
    if not product.image:
        return None
    url = product.image.url
    return request.build_absolute_uri(url) if request else url


class ProductPacketSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductPacket
        fields = ("id", "size", "price", "display_order", "is_active")
        read_only_fields = ("id",)

    def validate_size(self, value: Decimal) -> Decimal:
        if value <= 0:
            raise serializers.ValidationError("Packet size must be greater than zero.")
        return value

    def validate_price(self, value: Decimal) -> Decimal:
        if value < 0:
            raise serializers.ValidationError("Packet price cannot be negative.")
        return value


class ProductSerializer(serializers.ModelSerializer):
    category = CategorySummarySerializer(read_only=True)
    packets = ProductPacketSerializer(many=True, required=False)
    category_id = serializers.UUIDField(
        write_only=True,
        required=False,
        allow_null=True,
    )
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            "id",
            "name",
            "secondary_name",
            "description",
            "sku",
            "barcode",
            "unit",
            "purchase_price",
            "selling_price",
            "tax_rate",
            "is_tax_inclusive",
            "is_active",
            "pricing_mode",
            "packets",
            "category",
            "category_id",
            "image_url",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_image_url(self, product) -> str | None:
        return product_image_url(product, self.context.get("request"))

    def validate_name(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Product name cannot be empty.")
        return value

    def validate_sku(self, value: str) -> str:
        value = value.strip().upper()
        if not value:
            raise serializers.ValidationError("SKU cannot be empty.")
        request = self.context["request"]
        queryset = Product.objects.filter(
            shop=request.user.shop,
            sku__iexact=value,
        )
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError(
                "A product with this SKU already exists."
            )
        return value

    def validate_barcode(self, value: str | None) -> str | None:
        value = value.strip() if value else None
        if not value:
            return None
        request = self.context["request"]
        queryset = Product.objects.filter(
            shop=request.user.shop,
            barcode=value,
        )
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError(
                "A product with this barcode already exists."
            )
        return value

    def validate_category_id(self, value):
        if value is None:
            return None
        request = self.context["request"]
        try:
            return ProductCategory.objects.get(pk=value, shop=request.user.shop)
        except ProductCategory.DoesNotExist as exc:
            raise serializers.ValidationError(
                "Select a category from your shop."
            ) from exc

    def validate_purchase_price(self, value: Decimal) -> Decimal:
        if value < 0:
            raise serializers.ValidationError("Purchase price cannot be negative.")
        return value

    def validate_selling_price(self, value: Decimal) -> Decimal:
        if value < 0:
            raise serializers.ValidationError("Selling price cannot be negative.")
        return value

    def validate_tax_rate(self, value: Decimal) -> Decimal:
        if value < 0 or value > 100:
            raise serializers.ValidationError(
                "Tax rate must be between 0 and 100."
            )
        return value

    def validate(self, attrs):
        if "shop" in self.initial_data or "shop_id" in self.initial_data:
            raise serializers.ValidationError(
                {"shop_id": "Shop cannot be supplied."}
            )
        category = attrs.pop("category_id", serializers.empty)
        if category is not serializers.empty:
            attrs["category"] = category

        mode = attrs.get(
            "pricing_mode",
            self.instance.pricing_mode if self.instance else Product.PricingMode.STANDARD,
        )
        packets = attrs.get("packets")
        if mode == Product.PricingMode.MULTI:
            # A multi-pricing product with no packets would offer the cashier a
            # Packet button with nothing behind it.
            defined = packets if packets is not None else (
                list(self.instance.packets.all()) if self.instance else []
            )
            if not defined:
                raise serializers.ValidationError(
                    {"packets": "Define at least one packet size."}
                )
            sizes = [
                packet["size"] if isinstance(packet, dict) else packet.size
                for packet in defined
            ]
            if len(sizes) != len(set(sizes)):
                raise serializers.ValidationError(
                    {"packets": "Each packet size may only be defined once."}
                )
        elif packets:
            raise serializers.ValidationError(
                {"packets": "Enable multi-pricing before defining packet sizes."}
            )
        return attrs


class ProductImportUploadSerializer(serializers.Serializer):
    file = serializers.FileField()

    def validate_file(self, value):
        if not value.name.lower().endswith(".csv"):
            raise serializers.ValidationError("Upload a CSV (.csv) file.")
        if value.size > MAX_IMPORT_BYTES:
            raise serializers.ValidationError("CSV files must be 5 MB or smaller.")
        return value


class ProductImageUploadSerializer(serializers.Serializer):
    image = serializers.ImageField()

    def validate_image(self, value):
        # Size first: cheapest check, and it bounds the work below.
        if value.size > MAX_PRODUCT_IMAGE_BYTES:
            raise serializers.ValidationError("Images must be 5 MB or smaller.")
        # ImageField already ran Pillow's verify() and set `image`, so the
        # detected format is trustworthy - a .png-named JPEG or a renamed
        # non-image is caught here rather than by its filename.
        detected = getattr(value.image, "format", None)
        if detected not in ALLOWED_PRODUCT_IMAGE_FORMATS:
            raise serializers.ValidationError(
                "Upload a JPG, PNG, or WEBP image."
            )
        return value


class ProductImportConfirmSerializer(serializers.Serializer):
    duplicate_strategy = serializers.ChoiceField(
        choices=ProductImport.DuplicateStrategy.choices
    )
    confirmed = serializers.BooleanField()

    def validate_confirmed(self, value):
        if value is not True:
            raise serializers.ValidationError(
                "Explicit confirmation is required."
            )
        return value


class ProductImportRowSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImportRow
        fields = (
            "id",
            "row_number",
            "raw_data",
            "normalized_data",
            "errors",
            "warnings",
            "duplicate_fields",
        )


class ProductImportSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(
        source="created_by.full_name",
        read_only=True,
    )
    validation_id = serializers.UUIDField(source="id", read_only=True)
    invalid_rows = serializers.IntegerField(source="error_rows", read_only=True)
    can_import = serializers.SerializerMethodField()
    duplicate_summary = serializers.SerializerMethodField()

    class Meta:
        model = ProductImport
        fields = (
            "id",
            "validation_id",
            "filename",
            "status",
            "duplicate_strategy",
            "total_rows",
            "valid_rows",
            "error_rows",
            "invalid_rows",
            "warning_rows",
            "duplicate_rows",
            "duplicate_summary",
            "products_created",
            "products_updated",
            "products_skipped",
            "categories_created",
            "categories_to_create",
            "inventory_initialized",
            "opening_movements_created",
            "error_message",
            "failure_code",
            "created_by_name",
            "started_at",
            "completed_at",
            "expires_at",
            "duration_ms",
            "created_at",
            "can_import",
        )

    def get_can_import(self, obj: ProductImport) -> bool:
        return (
            obj.status == ProductImport.Status.VALIDATED
            and obj.error_rows == 0
            and (obj.expires_at is None or obj.expires_at > timezone.now())
        )

    def get_duplicate_summary(self, obj: ProductImport) -> dict:
        return {
            "existing_rows": obj.duplicate_rows,
            "strategy_required": obj.duplicate_rows > 0,
        }
