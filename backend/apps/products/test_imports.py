import csv
import io
from decimal import Decimal
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse

from apps.accounts.models import User
from apps.inventory.models import InventoryBalance, StockMovement
from apps.shops.models import Shop

from .import_services import CSV_HEADERS, IMPORT_BATCH_SIZE
from .models import Product, ProductCategory, ProductImport

PASSWORD = "ProductImportPassword123!"


def csv_file(*rows: list[str], name: str = "products.csv") -> SimpleUploadedFile:
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(CSV_HEADERS)
    writer.writerows(rows)
    return SimpleUploadedFile(
        name,
        output.getvalue().encode(),
        content_type="text/csv",
    )


def row(**overrides) -> list[str]:
    values = {
        "Product Name": "Baladna Milk 1L",
        "Category": "Dairy",
        "SKU": "MILK-IMPORT-1",
        "Barcode": "",
        "Unit": "BOTTLE",
        "Purchase Price": "5.00",
        "Selling Price": "6.00",
        "Opening Stock": "24.000",
        "Low Stock Alert": "5.000",
        "Status": "Active",
    }
    values.update(overrides)
    return [values[header] for header in CSV_HEADERS]


class ProductImportApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.shop = Shop.objects.create(
            name="Import Grocery",
            address="Doha",
            phone="+974 5555 9401",
        )
        cls.other_shop = Shop.objects.create(
            name="Other Import Grocery",
            address="Doha",
            phone="+974 5555 9402",
        )
        cls.owner = User.objects.create_user(
            shop=cls.shop,
            username="import-owner",
            password=PASSWORD,
            full_name="Import Owner",
            role=User.Role.OWNER,
        )
        cls.cashier = User.objects.create_user(
            shop=cls.shop,
            username="import-cashier",
            password=PASSWORD,
            full_name="Import Cashier",
        )
        cls.other_owner = User.objects.create_user(
            shop=cls.other_shop,
            username="other-import-owner",
            password=PASSWORD,
            full_name="Other Import Owner",
            role=User.Role.OWNER,
        )

    def login(self, user):
        self.client.force_login(
            user,
            backend="common.authentication.ShopModelBackend",
        )

    def validate(self, *rows):
        return self.client.post(
            reverse("products_api:product-import-list"),
            {"file": csv_file(*rows)},
        )

    def confirm(self, import_id, strategy="SKIP"):
        return self.client.post(
            reverse("products_api:product-import-confirm", args=[import_id]),
            {"duplicate_strategy": strategy},
            content_type="application/json",
        )

    def test_template_is_csv_and_import_endpoints_are_owner_only(self):
        self.login(self.owner)
        template = self.client.get(
            reverse("products_api:product-import-template")
        )
        self.assertEqual(template.status_code, 200)
        self.assertTrue(template["Content-Type"].startswith("text/csv"))
        self.assertEqual(
            next(csv.reader(io.StringIO(template.content.decode()))),
            list(CSV_HEADERS),
        )

        self.login(self.cashier)
        self.assertEqual(
            self.client.get(
                reverse("products_api:product-import-template")
            ).status_code,
            403,
        )
        self.assertEqual(self.validate(row()).status_code, 403)

    def test_validate_preview_and_confirm_creates_category_product_and_inventory(self):
        self.login(self.owner)
        validated = self.validate(
            row(
                **{
                    "SKU": "",
                    "Barcode": "",
                    "Unit": "KG",
                    "Opening Stock": "18.500",
                }
            )
        )
        self.assertEqual(validated.status_code, 201)
        summary = validated.json()["data"]
        self.assertEqual(summary["valid_rows"], 1)
        self.assertEqual(summary["error_rows"], 0)
        import_id = summary["id"]

        detail = self.client.get(
            reverse("products_api:product-import-detail", args=[import_id])
        )
        preview = detail.json()["data"]["rows"]["results"][0]
        self.assertTrue(preview["normalized_data"]["sku"].startswith("AUTO-"))
        self.assertIsNone(preview["normalized_data"]["barcode"])
        self.assertEqual(Product.objects.filter(shop=self.shop).count(), 0)

        completed = self.confirm(import_id)
        self.assertEqual(completed.status_code, 200)
        result = completed.json()["data"]
        self.assertEqual(result["products_created"], 1)
        self.assertEqual(result["categories_created"], 1)
        self.assertEqual(result["inventory_initialized"], 1)
        product = Product.objects.get(shop=self.shop)
        self.assertEqual(product.unit, Product.Unit.KG)
        self.assertIsNone(product.barcode)
        self.assertEqual(product.category.name, "Dairy")
        balance = InventoryBalance.objects.get(product=product)
        self.assertEqual(balance.quantity_on_hand, Decimal("18.500"))
        movement = StockMovement.objects.get(product=product)
        self.assertEqual(movement.movement_type, StockMovement.Type.OPENING)

    def test_validation_errors_are_previewed_without_catalogue_changes(self):
        self.login(self.owner)
        response = self.validate(
            row(
                **{
                    "Product Name": "",
                    "Selling Price": "-1",
                    "Opening Stock": "",
                    "Low Stock Alert": "2",
                    "Status": "unknown",
                }
            )
        )
        self.assertEqual(response.status_code, 201)
        product_import = response.json()["data"]
        self.assertEqual(product_import["error_rows"], 1)
        detail = self.client.get(
            reverse(
                "products_api:product-import-detail",
                args=[product_import["id"]],
            )
        ).json()["data"]
        errors = detail["rows"]["results"][0]["errors"]
        self.assertIn("product_name", errors)
        self.assertIn("selling_price", errors)
        self.assertIn("low_stock_alert", errors)
        self.assertIn("status", errors)
        denied = self.confirm(product_import["id"])
        self.assertEqual(denied.status_code, 400)
        self.assertFalse(Product.objects.filter(shop=self.shop).exists())
        self.assertFalse(ProductCategory.objects.filter(shop=self.shop).exists())

    def test_duplicate_rows_in_csv_are_rejected(self):
        self.login(self.owner)
        response = self.validate(
            row(),
            row(**{"Product Name": "Second", "Barcode": "123"}),
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["data"]["error_rows"], 1)
        self.assertEqual(response.json()["data"]["valid_rows"], 1)

    def test_duplicate_strategies_skip_update_and_cancel(self):
        existing = Product.objects.create(
            shop=self.shop,
            name="Old Milk",
            sku="EXISTING",
            barcode="123456",
            selling_price=Decimal("4.00"),
        )
        self.login(self.owner)

        skipped_import = self.validate(
            row(**{"SKU": "existing", "Barcode": "123456"})
        ).json()["data"]
        skipped = self.confirm(skipped_import["id"], "SKIP")
        self.assertEqual(skipped.status_code, 200)
        self.assertEqual(skipped.json()["data"]["products_skipped"], 1)
        existing.refresh_from_db()
        self.assertEqual(existing.name, "Old Milk")
        self.assertFalse(InventoryBalance.objects.filter(product=existing).exists())

        updated_import = self.validate(
            row(
                **{
                    "Product Name": "Updated Milk",
                    "SKU": "EXISTING",
                    "Barcode": "123456",
                    "Selling Price": "7.25",
                }
            )
        ).json()["data"]
        updated = self.confirm(updated_import["id"], "UPDATE")
        self.assertEqual(updated.status_code, 200)
        existing.refresh_from_db()
        self.assertEqual(existing.name, "Updated Milk")
        self.assertEqual(existing.selling_price, Decimal("7.25"))
        self.assertTrue(InventoryBalance.objects.filter(product=existing).exists())

        cancelled_import = self.validate(
            row(
                **{
                    "SKU": "EXISTING",
                    "Barcode": "123456",
                    "Opening Stock": "",
                    "Low Stock Alert": "",
                }
            )
        ).json()["data"]
        cancelled = self.confirm(cancelled_import["id"], "CANCEL")
        self.assertEqual(cancelled.status_code, 400)
        self.assertEqual(
            ProductImport.objects.get(pk=cancelled_import["id"]).status,
            ProductImport.Status.VALIDATED,
        )
        self.assertEqual(Product.objects.filter(shop=self.shop).count(), 1)

    def test_import_history_and_detail_are_isolated_by_shop(self):
        self.login(self.owner)
        import_id = self.validate(row()) .json()["data"]["id"]
        history = self.client.get(
            reverse("products_api:product-import-list")
        ).json()["data"]
        self.assertEqual(history["count"], 1)

        self.login(self.other_owner)
        other_history = self.client.get(
            reverse("products_api:product-import-list")
        ).json()["data"]
        self.assertEqual(other_history["count"], 0)
        hidden = self.client.get(
            reverse("products_api:product-import-detail", args=[import_id])
        )
        self.assertEqual(hidden.status_code, 404)

    def test_runtime_failure_rolls_back_products_categories_and_inventory(self):
        self.login(self.owner)
        import_id = self.validate(row()).json()["data"]["id"]
        with patch(
            "apps.products.import_services.initialize_inventory",
            side_effect=RuntimeError("simulated failure"),
        ):
            response = self.confirm(import_id)
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Product.objects.filter(shop=self.shop).exists())
        self.assertFalse(ProductCategory.objects.filter(shop=self.shop).exists())
        product_import = ProductImport.objects.get(pk=import_id)
        self.assertEqual(product_import.status, ProductImport.Status.FAILED)
        self.assertNotIn("simulated failure", product_import.error_message)

    def test_more_than_one_processing_batch_imports_all_rows(self):
        self.login(self.owner)
        rows = [
            row(
                **{
                    "Product Name": f"Product {index}",
                    "SKU": f"BATCH-{index}",
                    "Opening Stock": "",
                    "Low Stock Alert": "",
                }
            )
            for index in range(IMPORT_BATCH_SIZE + 1)
        ]
        import_id = self.validate(*rows).json()["data"]["id"]
        response = self.confirm(import_id)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["products_created"], len(rows))
        self.assertEqual(
            Product.objects.filter(shop=self.shop).count(),
            len(rows),
        )
