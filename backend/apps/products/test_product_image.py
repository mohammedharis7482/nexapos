import io
import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from PIL import Image

from apps.products.image_rules import MAX_PRODUCT_IMAGE_BYTES

from .models import Product
from .test_catalogue_api import CatalogueApiTestCase

MEDIA_ROOT = tempfile.mkdtemp(prefix="nexapos-test-media-")


def image_bytes(fmt="JPEG", size=(64, 64), colour=(200, 30, 30)):
    buffer = io.BytesIO()
    Image.new("RGB", size, colour).save(buffer, format=fmt)
    return buffer.getvalue()


def upload(fmt="JPEG", filename="photo.jpg", content_type="image/jpeg", payload=None):
    return SimpleUploadedFile(
        filename,
        payload if payload is not None else image_bytes(fmt),
        content_type=content_type,
    )


@override_settings(MEDIA_ROOT=MEDIA_ROOT)
class ProductImageApiTests(CatalogueApiTestCase):
    """Uploads write into a temp MEDIA_ROOT that is removed afterwards, so the
    suite never leaves files in the real media directory."""

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(MEDIA_ROOT, ignore_errors=True)
        super().tearDownClass()

    def url(self, product=None):
        return reverse(
            "products_api:product-image", args=[(product or self.milk).id]
        )

    def test_owner_uploads_a_valid_image_and_url_is_absolute(self):
        self.login(self.owner)
        response = self.client.post(self.url(), {"image": upload()}, format="multipart")

        self.assertEqual(response.status_code, 200)
        image_url = response.json()["data"]["image_url"]
        self.assertIsNotNone(image_url)
        self.assertTrue(image_url.startswith("http://"), image_url)
        self.assertIn("product-images/", image_url)

        self.milk.refresh_from_db()
        self.assertTrue(self.milk.image)
        # Stored under a normalized name derived from the product id.
        self.assertIn(str(self.milk.id), self.milk.image.name)

    def test_product_without_an_image_serializes_null_not_broken(self):
        self.login(self.owner)
        detail = self.client.get(
            reverse("products_api:product-detail", args=[self.cola.id])
        )
        self.assertEqual(detail.status_code, 200)
        self.assertIsNone(detail.json()["data"]["image_url"])

        listing = self.client.get(reverse("products_api:product-list"))
        self.assertEqual(listing.status_code, 200)
        rows = listing.json()["data"]["results"]
        self.assertTrue(rows)
        # Every row carries the key explicitly rather than omitting it.
        for row in rows:
            self.assertIn("image_url", row)

    def test_oversized_image_is_rejected(self):
        self.login(self.owner)
        # Comfortably over the 5 MB ceiling; noise keeps it incompressible.
        import os

        oversized = os.urandom(MAX_PRODUCT_IMAGE_BYTES + 1024)
        response = self.client.post(
            self.url(),
            {"image": upload(payload=oversized)},
            format="multipart",
        )
        self.assertEqual(response.status_code, 400)
        self.milk.refresh_from_db()
        self.assertFalse(self.milk.image)

    def test_non_image_upload_is_rejected(self):
        self.login(self.owner)
        response = self.client.post(
            self.url(),
            {
                "image": SimpleUploadedFile(
                    "notes.txt", b"this is not an image", content_type="text/plain"
                )
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("image", response.json()["errors"])
        self.milk.refresh_from_db()
        self.assertFalse(self.milk.image)

    def test_disallowed_image_format_is_rejected_by_content_not_filename(self):
        self.login(self.owner)
        # A real GIF deliberately named .jpg with a JPEG content type: only
        # content inspection catches this.
        response = self.client.post(
            self.url(),
            {
                "image": SimpleUploadedFile(
                    "sneaky.jpg", image_bytes(fmt="GIF"), content_type="image/jpeg"
                )
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["message"], "Upload a JPG, PNG, or WEBP image."
        )
        self.milk.refresh_from_db()
        self.assertFalse(self.milk.image)

    def test_png_and_webp_are_accepted(self):
        self.login(self.owner)
        for fmt, name in (("PNG", "a.png"), ("WEBP", "a.webp")):
            with self.subTest(format=fmt):
                response = self.client.post(
                    self.url(),
                    {"image": upload(fmt=fmt, filename=name, content_type="image/*")},
                    format="multipart",
                )
                self.assertEqual(response.status_code, 200)

    def test_replacing_an_image_removes_the_previous_file(self):
        self.login(self.owner)
        self.client.post(self.url(), {"image": upload()}, format="multipart")
        self.milk.refresh_from_db()
        first_name = self.milk.image.name
        first_storage = self.milk.image.storage

        self.client.post(
            self.url(),
            {"image": upload(fmt="PNG", filename="b.png")},
            format="multipart",
        )
        self.milk.refresh_from_db()
        self.assertNotEqual(self.milk.image.name, first_name)
        self.assertFalse(first_storage.exists(first_name))

    def test_delete_clears_the_image(self):
        self.login(self.owner)
        self.client.post(self.url(), {"image": upload()}, format="multipart")
        self.milk.refresh_from_db()
        self.assertTrue(self.milk.image)

        response = self.client.delete(self.url())
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["data"]["image_url"])
        self.milk.refresh_from_db()
        self.assertFalse(self.milk.image)

    def test_delete_is_idempotent_when_there_is_no_image(self):
        self.login(self.owner)
        response = self.client.delete(self.url(self.cola))
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["data"]["image_url"])

    def test_cashier_cannot_upload_or_delete(self):
        self.login(self.cashier)
        upload_response = self.client.post(
            self.url(), {"image": upload()}, format="multipart"
        )
        self.assertEqual(upload_response.status_code, 403)
        self.assertEqual(self.client.delete(self.url()).status_code, 403)
        self.milk.refresh_from_db()
        self.assertFalse(self.milk.image)

    def test_owner_cannot_touch_another_shops_product_image(self):
        self.login(self.owner)
        response = self.client.post(
            reverse("products_api:product-image", args=[self.other_milk.id]),
            {"image": upload()},
            format="multipart",
        )
        self.assertEqual(response.status_code, 404)
        self.other_milk.refresh_from_db()
        self.assertFalse(self.other_milk.image)

    def test_uploading_does_not_disturb_other_product_fields(self):
        self.login(self.owner)
        before = Product.objects.get(pk=self.milk.pk)
        self.client.post(self.url(), {"image": upload()}, format="multipart")
        after = Product.objects.get(pk=self.milk.pk)

        for field in ("name", "sku", "barcode", "unit", "selling_price", "is_active"):
            self.assertEqual(
                getattr(before, field), getattr(after, field), f"{field} changed"
            )
