from django.db import transaction

from .models import Product, ProductCategory


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


@transaction.atomic
def create_product(*, shop, validated_data: dict) -> Product:
    from apps.saas.services import enforce_product_limit

    enforce_product_limit(shop)
    product = Product(shop=shop, **validated_data)
    product.full_clean()
    product.save()
    return product


@transaction.atomic
def update_product(*, product: Product, validated_data: dict) -> Product:
    from apps.saas.services import enforce_product_limit

    if not product.is_active and validated_data.get("is_active") is True:
        enforce_product_limit(product.shop)
    for field, value in validated_data.items():
        setattr(product, field, value)
    product.full_clean()
    product.save()
    return product
