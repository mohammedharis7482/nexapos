import csv
import io
from decimal import Decimal
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from apps.accounts.models import User
from apps.inventory.models import InventoryBalance, StockMovement
from apps.shops.models import Shop

from .import_contract import (
    PRODUCT_IMPORT_HEADERS,
    UNIT_DISPLAY_TO_VALUE,
)
from .import_services import IMPORT_BATCH_SIZE, MAX_IMPORT_BYTES, MAX_IMPORT_ROWS
from .models import Product, ProductCategory, ProductImport

PASSWORD = "ProductImportPassword123!"


def row(**overrides) -> dict[str, str]:
    values = {
        "Product Name": "Baladna Milk 1L",
        "Category": "Dairy",
        "Unit": "Bottle",
        "SKU": "MILK-IMPORT-1",
        "Barcode": "",
        "Description": "",
        "Purchase Price (QAR)": "5.00",
        "Selling Price (QAR)": "6.00",
        "Tax Rate": "Tax Exempt",
        "Opening Quantity": "24.000",
        "Low Stock Threshold": "5.000",
        "Status": "Active",
    }
    values.update(overrides)
    return values


def csv_file(
    *rows: dict[str, str],
    name: str = "products.csv",
    headers=PRODUCT_IMPORT_HEADERS,
    bom: bool = False,
    trailing_lines: bool = False,
) -> SimpleUploadedFile:
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(headers)
    for values in rows:
        writer.writerow([values.get(header, "") for header in headers])
    if trailing_lines:
        output.write("\n\n")
    content = output.getvalue().encode()
    if bom:
        content = b"\xef\xbb\xbf" + content
    return SimpleUploadedFile(name, content, content_type="text/csv")


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

    def validate_file(self, uploaded_file):
        return self.client.post(
            reverse("products_api:product-import-list"),
            {"file": uploaded_file},
        )

    def validate(self, *rows, **file_options):
        return self.validate_file(csv_file(*rows, **file_options))

    def confirm(self, import_id, strategy="SKIP", confirmed=True):
        return self.client.post(
            reverse("products_api:product-import-confirm", args=[import_id]),
            {"duplicate_strategy": strategy, "confirmed": confirmed},
            content_type="application/json",
        )

    def detail(self, import_id, query=""):
        return self.client.get(
            f"{reverse('products_api:product-import-detail', args=[import_id])}{query}"
        ).json()["data"]

    def test_downloaded_template_headers_are_canonical_and_validate_immediately(self):
        self.login(self.owner)
        template = self.client.get(
            reverse("products_api:product-import-template")
        )
        self.assertEqual(template.status_code, 200)
        self.assertEqual(
            next(csv.reader(io.StringIO(template.content.decode()))),
            list(PRODUCT_IMPORT_HEADERS),
        )
        uploaded = SimpleUploadedFile(
            "downloaded-template.csv",
            template.content,
            content_type="text/csv",
        )
        validated = self.validate_file(uploaded)
        self.assertEqual(validated.status_code, 201)
        self.assertTrue(validated.json()["data"]["can_import"])

    def test_template_and_import_flow_are_owner_only(self):
        self.login(self.cashier)
        self.assertEqual(
            self.client.get(
                reverse("products_api:product-import-template")
            ).status_code,
            403,
        )
        self.assertEqual(self.validate(row()).status_code, 403)

    def test_exact_uploaded_contract_normalizes_human_values(self):
        self.login(self.owner)
        response = self.validate(
            row(
                **{
                    "Product Name": "Nido Milk Powder 400g",
                    "Unit": "Piece",
                    "Barcode": "0123456789012",
                }
            ),
            row(
                **{
                    "Product Name": "Almarai Fresh Milk 1L",
                    "Unit": "Bottle",
                    "SKU": "MILK-2",
                }
            ),
            row(
                **{
                    "Product Name": "White Bread",
                    "Category": "Bakery",
                    "Unit": "Pack",
                    "SKU": "BREAD-1",
                }
            ),
            row(
                **{
                    "Product Name": "Tomato",
                    "Category": "Vegetables",
                    "Unit": "Kg",
                    "SKU": "TOMATO-1",
                    "Opening Quantity": "18.500",
                }
            ),
            row(
                **{
                    "Product Name": "Green Chilli",
                    "Category": "Vegetables",
                    "Unit": "Kg",
                    "SKU": "CHILLI-1",
                }
            ),
        )
        self.assertEqual(response.status_code, 201)
        summary = response.json()["data"]
        self.assertEqual(summary["total_rows"], 5)
        self.assertEqual(summary["error_rows"], 0)
        self.assertEqual(
            summary["categories_to_create"],
            ["Bakery", "Dairy", "Vegetables"],
        )
        preview = self.detail(summary["id"])["rows"]["results"]
        self.assertEqual(preview[0]["normalized_data"]["barcode"], "0123456789012")
        self.assertEqual(preview[0]["normalized_data"]["tax_rate"], "0.00")
        self.assertTrue(preview[0]["normalized_data"]["is_active"])
        self.assertEqual(
            [item["normalized_data"]["unit"] for item in preview],
            ["PIECE", "BOTTLE", "PACK", "KG", "KG"],
        )

        completed = self.confirm(summary["id"])
        self.assertEqual(completed.status_code, 200)
        self.assertEqual(completed.json()["data"]["products_created"], 5)
        tomato = Product.objects.get(shop=self.shop, sku="TOMATO-1")
        self.assertEqual(
            tomato.inventory_balance.quantity_on_hand,
            Decimal("18.500"),
        )
        billing_search = self.client.get(
            reverse("inventory_api:list"),
            {"search": "Tomato"},
        )
        self.assertContains(billing_search, "Tomato")

    def test_safe_51_row_fixture_validates(self):
        self.login(self.owner)
        units = list(UNIT_DISPLAY_TO_VALUE)
        rows = [
            row(
                **{
                    "Product Name": f"Fixture Product {index}",
                    "Category": f"Category {index % 5}",
                    "Unit": units[index % len(units)],
                    "SKU": f"FIXTURE-{index:03}",
                    "Barcode": f"06281000{index:05}",
                }
            )
            for index in range(51)
        ]
        response = self.validate(*rows)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["data"]["total_rows"], 51)
        self.assertEqual(response.json()["data"]["error_rows"], 0)

    def test_utf8_bom_quoted_comma_and_blank_trailing_lines(self):
        self.login(self.owner)
        response = self.validate(
            row(
                **{
                    "Product Name": "Arabic خبز",
                    "Description": "Fresh, sliced bread",
                }
            ),
            bom=True,
            trailing_lines=True,
        )
        self.assertEqual(response.status_code, 201)
        preview = self.detail(response.json()["data"]["id"])["rows"]["results"][0]
        self.assertEqual(
            preview["normalized_data"]["description"],
            "Fresh, sliced bread",
        )

    def test_headers_are_normalized_conservatively(self):
        self.login(self.owner)
        headers = tuple(
            f"  {header.upper()}  "
            if header != "Product Name"
            else "product_name"
            for header in PRODUCT_IMPORT_HEADERS
        )
        values = row()
        aliased = {
            headers[index]: values[canonical]
            for index, canonical in enumerate(PRODUCT_IMPORT_HEADERS)
        }
        response = self.validate(aliased, headers=headers)
        self.assertEqual(response.status_code, 201)

    def test_structured_missing_duplicate_unexpected_and_empty_headers(self):
        self.login(self.owner)
        headers = list(PRODUCT_IMPORT_HEADERS)
        headers[0] = ""
        headers[1] = "SKU"
        headers[-1] = "Unknown Column"
        response = self.validate(row(), headers=headers)
        self.assertEqual(response.status_code, 400)
        body = response.json()
        self.assertEqual(body["code"], "INVALID_HEADERS")
        codes = {
            error["error_code"]
            for error in body["errors"]["import_errors"]
        }
        self.assertIn("EMPTY_HEADER", codes)
        self.assertIn("DUPLICATE_HEADER", codes)
        self.assertIn("UNSUPPORTED_HEADER", codes)
        self.assertIn("MISSING_HEADER", codes)
        self.assertFalse(ProductImport.objects.filter(shop=self.shop).exists())

    def test_wrong_delimiter_binary_malformed_and_oversized_files_are_rejected(self):
        self.login(self.owner)
        wrong_delimiter = SimpleUploadedFile(
            "wrong.csv",
            b"Product Name;Category;Unit\nMilk;Dairy;Bottle",
            content_type="text/csv",
        )
        self.assertEqual(self.validate_file(wrong_delimiter).status_code, 400)
        binary = SimpleUploadedFile(
            "renamed.csv",
            b"\x89PNG\r\n\x1a\n\x00binary",
            content_type="text/csv",
        )
        self.assertEqual(self.validate_file(binary).status_code, 400)
        malformed = SimpleUploadedFile(
            "malformed.csv",
            (
                ",".join(PRODUCT_IMPORT_HEADERS)
                + '\n"unterminated'
            ).encode(),
            content_type="text/csv",
        )
        malformed_response = self.validate_file(malformed)
        self.assertEqual(malformed_response.status_code, 400)
        self.assertEqual(malformed_response.json()["code"], "MALFORMED_CSV")
        oversized = SimpleUploadedFile(
            "large.csv",
            b"a" * (MAX_IMPORT_BYTES + 1),
            content_type="text/csv",
        )
        self.assertEqual(self.validate_file(oversized).status_code, 400)
        renamed = SimpleUploadedFile("products.txt", b"csv")
        self.assertEqual(self.validate_file(renamed).status_code, 400)

    def test_too_many_rows_are_rejected_without_history(self):
        self.login(self.owner)
        repeated = row()
        output = io.StringIO(newline="")
        writer = csv.DictWriter(output, fieldnames=PRODUCT_IMPORT_HEADERS)
        writer.writeheader()
        writer.writerows(
            {**repeated, "SKU": f"ROW-{index}"}
            for index in range(MAX_IMPORT_ROWS + 1)
        )
        response = self.validate_file(
            SimpleUploadedFile("too-many.csv", output.getvalue().encode())
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], "TOO_MANY_ROWS")
        self.assertFalse(ProductImport.objects.filter(shop=self.shop).exists())

    def test_all_display_units_statuses_taxes_and_decimal_values(self):
        self.login(self.owner)
        rows = [
            row(
                **{
                    "Product Name": f"{display} product",
                    "Unit": display,
                    "SKU": f"UNIT-{internal}",
                    "Status": "Inactive" if index % 2 else "Active",
                    "Tax Rate": "5%" if index % 2 else "Tax Exempt",
                    "Opening Quantity": "18.500",
                }
            )
            for index, (display, internal) in enumerate(
                UNIT_DISPLAY_TO_VALUE.items()
            )
        ]
        response = self.validate(*rows)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["data"]["error_rows"], 0)

    def test_invalid_unit_negative_values_and_scientific_barcode_are_structured(self):
        self.login(self.owner)
        response = self.validate(
            row(
                **{
                    "Unit": "Bottlee",
                    "Barcode": "6.281E+12",
                    "Purchase Price (QAR)": "-1",
                    "Selling Price (QAR)": "-2",
                    "Opening Quantity": "-3",
                    "Low Stock Threshold": "-4",
                }
            )
        )
        self.assertEqual(response.status_code, 201)
        summary = response.json()["data"]
        self.assertFalse(summary["can_import"])
        issues = self.detail(summary["id"])["rows"]["results"][0]["errors"]
        codes = {issue["error_code"] for issue in issues}
        self.assertIn("INVALID_UNIT", codes)
        self.assertIn("SCIENTIFIC_NOTATION_BARCODE", codes)
        self.assertIn("NEGATIVE_VALUE", codes)

    def test_warning_does_not_block_import(self):
        self.login(self.owner)
        response = self.validate(
            row(
                **{
                    "Purchase Price (QAR)": "10.00",
                    "Selling Price (QAR)": "8.00",
                }
            )
        )
        summary = response.json()["data"]
        self.assertTrue(summary["can_import"])
        self.assertEqual(summary["warning_rows"], 1)

    def test_validation_reuses_category_case_insensitively_without_writing(self):
        ProductCategory.objects.create(shop=self.shop, name="Dairy")
        ProductCategory.objects.create(shop=self.other_shop, name="Vegetables")
        self.login(self.owner)
        response = self.validate(
            row(**{"Category": "dAiRy"}),
            row(
                **{
                    "Product Name": "Tomato",
                    "Category": "Vegetables",
                    "SKU": "TOMATO",
                }
            ),
        )
        summary = response.json()["data"]
        self.assertEqual(summary["categories_to_create"], ["Vegetables"])
        self.assertEqual(
            ProductCategory.objects.filter(shop=self.shop).count(),
            1,
        )
        self.assertFalse(Product.objects.filter(shop=self.shop).exists())
        self.assertFalse(InventoryBalance.objects.filter(shop=self.shop).exists())
        self.assertFalse(StockMovement.objects.filter(shop=self.shop).exists())

    def test_duplicate_file_values_and_database_strategies(self):
        existing = Product.objects.create(
            shop=self.shop,
            name="Old Milk",
            sku="EXISTING",
            barcode="0012345678901",
            selling_price=Decimal("4.00"),
        )
        self.login(self.owner)
        duplicate_file = self.validate(
            row(**{"SKU": "DUPLICATE", "Barcode": "0000000000001"}),
            row(
                **{
                    "Product Name": "Other",
                    "SKU": "duplicate",
                    "Barcode": "0000000000001",
                }
            ),
        )
        self.assertEqual(duplicate_file.json()["data"]["error_rows"], 1)

        skipped_id = self.validate(
            row(**{"SKU": "existing", "Barcode": "0012345678901"})
        ).json()["data"]["id"]
        self.assertEqual(
            self.confirm(skipped_id, "SKIP").json()["data"]["products_skipped"],
            1,
        )
        existing.refresh_from_db()
        self.assertEqual(existing.name, "Old Milk")

        updated_id = self.validate(
            row(
                **{
                    "Product Name": "Updated Milk",
                    "SKU": "EXISTING",
                    "Barcode": "0012345678901",
                    "Selling Price (QAR)": "7.25",
                }
            )
        ).json()["data"]["id"]
        self.assertEqual(self.confirm(updated_id, "UPDATE").status_code, 200)
        existing.refresh_from_db()
        self.assertEqual(existing.selling_price, Decimal("7.25"))

        cancelled_id = self.validate(
            row(
                **{
                    "SKU": "EXISTING",
                    "Barcode": "0012345678901",
                    "Opening Quantity": "",
                    "Low Stock Threshold": "",
                }
            )
        ).json()["data"]["id"]
        self.assertEqual(self.confirm(cancelled_id, "CANCEL").status_code, 400)
        self.assertEqual(Product.objects.filter(shop=self.shop).count(), 1)

    def test_blank_sku_generated_blank_barcode_and_zero_weighted_stock(self):
        self.login(self.owner)
        import_id = self.validate(
            row(
                **{
                    "SKU": "",
                    "Barcode": "",
                    "Unit": "Kg",
                    "Opening Quantity": "0.000",
                }
            )
        ).json()["data"]["id"]
        preview = self.detail(import_id)["rows"]["results"][0]
        self.assertTrue(preview["normalized_data"]["sku"].startswith("AUTO-"))
        self.assertIsNone(preview["normalized_data"]["barcode"])
        self.assertEqual(self.confirm(import_id).status_code, 200)
        product = Product.objects.get(shop=self.shop)
        self.assertEqual(product.inventory_balance.quantity_on_hand, Decimal("0.000"))

    def test_confirmation_requires_explicit_confirmation_and_is_idempotent(self):
        self.login(self.owner)
        import_id = self.validate(row()).json()["data"]["id"]
        self.assertEqual(self.confirm(import_id, confirmed=False).status_code, 400)
        first = self.confirm(import_id)
        second = self.confirm(import_id)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(Product.objects.filter(shop=self.shop).count(), 1)
        self.assertEqual(InventoryBalance.objects.filter(shop=self.shop).count(), 1)
        self.assertEqual(StockMovement.objects.filter(shop=self.shop).count(), 1)

    def test_expired_validation_cannot_be_confirmed(self):
        self.login(self.owner)
        import_id = self.validate(row()).json()["data"]["id"]
        ProductImport.objects.filter(pk=import_id).update(
            expires_at=timezone.now(),
        )
        response = self.confirm(import_id)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], "VALIDATION_EXPIRED")
        self.assertFalse(Product.objects.filter(shop=self.shop).exists())

    def test_history_detail_error_report_and_cross_shop_isolation(self):
        self.login(self.owner)
        import_id = self.validate(
            row(**{"Unit": "=FORMULA", "Product Name": "=unsafe"})
        ).json()["data"]["id"]
        history = self.client.get(
            reverse("products_api:product-import-list")
        ).json()["data"]
        self.assertEqual(history["count"], 1)
        filtered = self.detail(import_id, "?severity=error&column=Unit")
        self.assertEqual(filtered["rows"]["count"], 1)
        report = self.client.get(
            reverse("products_api:product-import-errors", args=[import_id])
        )
        self.assertEqual(report.status_code, 200)
        self.assertIn("'=unsafe", report.content.decode())

        self.login(self.other_owner)
        self.assertEqual(
            self.client.get(
                reverse("products_api:product-import-detail", args=[import_id])
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.get(
                reverse("products_api:product-import-errors", args=[import_id])
            ).status_code,
            404,
        )

    def test_runtime_failure_rolls_back_all_business_data(self):
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
        self.assertFalse(InventoryBalance.objects.filter(shop=self.shop).exists())
        product_import = ProductImport.objects.get(pk=import_id)
        self.assertEqual(product_import.status, ProductImport.Status.FAILED)
        self.assertEqual(product_import.failure_code, "IMPORT_TRANSACTION_FAILED")
        self.assertNotIn("simulated failure", product_import.error_message)

    def test_more_than_one_processing_batch_imports_all_rows(self):
        self.login(self.owner)
        rows = [
            row(
                **{
                    "Product Name": f"Product {index}",
                    "SKU": f"BATCH-{index}",
                    "Opening Quantity": "",
                    "Low Stock Threshold": "",
                }
            )
            for index in range(IMPORT_BATCH_SIZE + 1)
        ]
        import_id = self.validate(*rows).json()["data"]["id"]
        response = self.confirm(import_id)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["products_created"], len(rows))
