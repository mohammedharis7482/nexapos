import json
import logging
from types import SimpleNamespace
from unittest.mock import patch

from django.db.utils import OperationalError
from django.test import SimpleTestCase, TestCase
from django.urls import reverse
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIRequestFactory

from common.exceptions import api_exception_handler
from common.logging import SafeJsonFormatter
from common.params import parse_bool_param


class HealthEndpointTests(SimpleTestCase):
    @patch("common.middleware.request_logger.info")
    def test_request_completion_log_uses_safe_operational_fields(self, logger):
        response = self.client.get(reverse("health"))

        logger.assert_called_once_with(
            "request_completed",
            extra={
                "request_id": response["X-Request-ID"],
                "path": "/api/v1/health/",
                "method": "GET",
                "status_code": 200,
            },
        )

    def test_health_endpoint_is_public(self):
        response = self.client.get(reverse("health"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"status": "ok", "service": "NexaPOS API"},
        )
        self.assertRegex(response["X-Request-ID"], r"^[0-9a-f]{32}$")

    def test_json_formatter_emits_status_without_unsafe_payloads(self):
        record = logging.LogRecord(
            "nexapos.request", logging.INFO, "", 0, "request_completed", (), None
        )
        record.request_id = "safe-id"
        record.path = "/api/v1/health/"
        record.method = "GET"
        record.status_code = 200
        output = json.loads(SafeJsonFormatter().format(record))

        self.assertEqual(output["request_id"], "safe-id")
        self.assertEqual(output["status_code"], "200")
        self.assertNotIn("body", output)


class ReadinessEndpointTests(TestCase):
    def test_readiness_checks_the_database_without_exposing_details(self):
        response = self.client.get(reverse("readiness"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"status": "ready", "service": "NexaPOS API"},
        )

    @patch("common.views.connection.cursor", side_effect=OperationalError)
    def test_readiness_returns_safe_unavailable_response(self, _cursor):
        response = self.client.get(reverse("readiness"))

        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.json(),
            {"status": "unavailable", "service": "NexaPOS API"},
        )
        self.assertNotContains(response, "database", status_code=503)


class ParseBoolParamTests(SimpleTestCase):
    def test_accepts_true_and_false_case_insensitively(self):
        self.assertIs(parse_bool_param("true"), True)
        self.assertIs(parse_bool_param("True"), True)
        self.assertIs(parse_bool_param("TRUE"), True)
        self.assertIs(parse_bool_param("false"), False)
        self.assertIs(parse_bool_param("False"), False)

    def test_treats_anything_else_as_no_filter(self):
        self.assertIsNone(parse_bool_param(""))
        self.assertIsNone(parse_bool_param("maybe"))
        self.assertIsNone(parse_bool_param("1"))


class ApiExceptionHandlerTests(SimpleTestCase):
    @patch("common.exceptions.logger.error")
    def test_unhandled_errors_use_safe_contract_and_correlation_fields(self, logger):
        request = APIRequestFactory().get("/api/v1/example/")
        request.request_id = "request-id"
        request.user = SimpleNamespace(is_authenticated=False)

        response = api_exception_handler(
            RuntimeError("private database detail"),
            {"request": request, "view": object()},
        )

        self.assertEqual(response.status_code, 500)
        self.assertEqual(
            response.data,
            {
                "success": False,
                "message": "NexaPOS could not complete the request.",
                "errors": {},
            },
        )
        self.assertNotIn("private database detail", str(response.data))
        logger.assert_called_once()

    def _handle(self, exc):
        request = APIRequestFactory().post("/api/v1/example/")
        request.request_id = "request-id"
        request.user = SimpleNamespace(is_authenticated=False)
        return api_exception_handler(exc, {"request": request, "view": object()})

    def test_single_field_rejection_surfaces_its_real_reason_as_the_message(self):
        # Domain rejections carry their reason under a field key, not under
        # "detail" - without promotion the cashier only ever saw the generic
        # fallback while the real reason sat unread inside `errors`.
        response = self._handle(
            ValidationError({"quantity": "Requested quantity exceeds available stock."})
        )

        self.assertEqual(
            response.data["message"], "Requested quantity exceeds available stock."
        )
        # DRF keeps a bare string value as ErrorDetail (a str subclass)
        # rather than wrapping it in a list, so compare as text.
        self.assertEqual(
            str(response.data["errors"]["quantity"]),
            "Requested quantity exceeds available stock.",
        )

    def test_single_field_rejection_in_list_form_is_promoted(self):
        response = self._handle(
            ValidationError({"status": ["This user already has an open shift."]})
        )

        self.assertEqual(
            response.data["message"], "This user already has an open shift."
        )

    def test_multi_field_form_errors_keep_the_generic_summary_message(self):
        # Forms render a generic banner plus per-field errors; promoting one
        # arbitrary field's message here would be actively misleading.
        response = self._handle(
            ValidationError({"name": ["Required."], "sku": ["Required."]})
        )

        self.assertEqual(response.data["message"], "Please check the entered details.")
        self.assertEqual(
            response.data["errors"], {"name": ["Required."], "sku": ["Required."]}
        )

    def test_structured_payloads_are_never_stringified_into_the_message(self):
        # A single-key error whose value is structured data (import_errors)
        # must not leak a repr of that data as the user-facing message.
        response = self._handle(
            ValidationError({"import_errors": [{"row_number": 2, "column": "sku"}]})
        )

        self.assertEqual(response.data["message"], "Please check the entered details.")
        self.assertNotIn("row_number", response.data["message"])

    def test_coded_errors_still_take_priority_over_field_promotion(self):
        response = self._handle(
            ValidationError({
                "code": "IMPORT_FAILED",
                "detail": "The CSV could not be read.",
                "import_errors": [{"row_number": 2}],
            })
        )

        self.assertEqual(response.data["code"], "IMPORT_FAILED")
        self.assertEqual(response.data["message"], "The CSV could not be read.")
        # The structured payload survives alongside the coded message (DRF
        # coerces scalars inside it to ErrorDetail, hence the str compare).
        rows = response.data["errors"]["import_errors"]
        self.assertEqual(len(rows), 1)
        self.assertEqual(str(rows[0]["row_number"]), "2")
