"""Product image upload rules.

Kept in its own module with no app-level imports so both the serializer
(validation) and the service (storage) can use it without a circular import.
"""

MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024

# Pillow format names, not client-supplied content types or file extensions.
ALLOWED_PRODUCT_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}

PRODUCT_IMAGE_EXTENSIONS = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}
