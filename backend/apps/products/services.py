import uuid

from django.db import transaction

from .image_rules import PRODUCT_IMAGE_EXTENSIONS
from .models import Product, ProductCategory, ProductPacket


def generate_product_sku(*, shop, reserved: set[str] | None = None) -> str:
    """Generate a collision-resistant shop SKU for trusted server workflows."""

    reserved_keys = {value.casefold() for value in (reserved or set())}
    while True:
        candidate = f"AUTO-{uuid.uuid4().hex[:12].upper()}"
        if (
            candidate.casefold() not in reserved_keys
            and not Product.objects.filter(shop=shop, sku__iexact=candidate).exists()
        ):
            return candidate


@transaction.atomic
def create_category(*, shop, validated_data: dict) -> ProductCategory:
    category = ProductCategory(shop=shop, **validated_data)
    category.full_clean()
    category.save()
    return category


@transaction.atomic
def update_category(
    *,
    category: ProductCategory,
    validated_data: dict,
) -> ProductCategory:
    for field, value in validated_data.items():
        setattr(category, field, value)
    category.full_clean()
    category.save()
    return category


def _sync_packets(*, product: Product, packets: list[dict] | None) -> None:
    """Replace a product's packet definitions with the supplied set.

    Packets already referenced by a sale are deactivated rather than deleted:
    SaleItem.packet is PROTECT, and a past sale must keep pointing at the
    definition it was billed under. Deactivated packets stop appearing in
    billing but stay resolvable for history.
    """
    if packets is None:
        return
    if product.pricing_mode == Product.PricingMode.STANDARD:
        packets = []
    keep_sizes = {packet["size"] for packet in packets}
    for existing in product.packets.all():
        if existing.size in keep_sizes:
            continue
        if existing.sale_items.exists():
            if existing.is_active:
                existing.is_active = False
                existing.save(update_fields=["is_active", "updated_at"])
        else:
            existing.delete()
    for index, packet in enumerate(packets):
        ProductPacket.objects.update_or_create(
            product=product,
            size=packet["size"],
            defaults={
                "price": packet["price"],
                "display_order": packet.get("display_order", index),
                "is_active": packet.get("is_active", True),
            },
        )


@transaction.atomic
def create_product(*, shop, validated_data: dict) -> Product:
    from apps.saas.services import enforce_product_limit

    enforce_product_limit(shop)
    packets = validated_data.pop("packets", None)
    product = Product(shop=shop, **validated_data)
    product.full_clean()
    product.save()
    _sync_packets(product=product, packets=packets)
    return product


@transaction.atomic
def update_product(*, product: Product, validated_data: dict) -> Product:
    from apps.saas.services import enforce_product_limit

    if not product.is_active and validated_data.get("is_active") is True:
        enforce_product_limit(product.shop)
    packets = validated_data.pop("packets", None)
    for field, value in validated_data.items():
        setattr(product, field, value)
    product.full_clean()
    product.save()
    # Switching back to STANDARD clears the packet offer even when the caller
    # sends no packets array, so a stale definition cannot linger.
    if product.pricing_mode == Product.PricingMode.STANDARD and packets is None:
        packets = []
    _sync_packets(product=product, packets=packets)
    return product


@transaction.atomic
def set_product_image(*, product: Product, image) -> Product:
    """Replace a product's image, deleting the previous file.

    The old file is removed via the storage API (`field.delete`), never by
    touching the filesystem, so this stays correct under a cloud backend.
    """
    # Capture the name as a plain string first: product.image is a FieldFile
    # that .save() mutates in place, so holding the object would compare a
    # name against itself and silently orphan the old file.
    previous_name = product.image.name or ""
    storage = product.image.storage
    normalized_name = f"{product.pk}.{PRODUCT_IMAGE_EXTENSIONS[image.image.format]}"
    product.image.save(normalized_name, image, save=False)
    product.save(update_fields=["image", "updated_at"])
    if previous_name and previous_name != product.image.name:
        storage.delete(previous_name)
    return product


@transaction.atomic
def clear_product_image(*, product: Product) -> Product:
    if not product.image:
        return product
    product.image.delete(save=False)
    product.image = ""
    product.save(update_fields=["image", "updated_at"])
    return product
