import json
import logging
from types import SimpleNamespace
from unittest.mock import patch

from django.db.utils import OperationalError
from django.test import SimpleTestCase, TestCase
from django.urls import reverse
from rest_framework.test import APIRequestFactory

from common.exceptions import api_exception_handler
from common.logging import SafeJsonFormatter


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
