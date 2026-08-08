"""Tests for the three optional CSV import columns.

Secondary Name, Image URL and Packet Sizes were added after the original
import contract shipped, so back-compatibility with older CSVs is tested
here as hard as the new behaviour itself.

The Image URL tests run against a real HTTP server on loopback rather than a
mocked transport. Mocking the socket would prove the parsing and skip exactly
the part that matters - what the server does when a hostile URL is handed to
it. Two rules keep that honest:

* The SSRF tests never patch the address screen. They point at the live
  server's real loopback address and assert the server recorded **no
  request** - proof the URL was rejected before any packet was sent, not
  merely that an exception surfaced somewhere.
* Only the tests about transfer and decoding (size caps, content sniffing,
  redirects) relax the address screen, via `allow_loopback`, because loopback
  is the only address a test can serve from. Those tests are not evidence
  about the screen; the tests above are.
"""

import io
import shutil
import tempfile
import threading
import time
from contextlib import contextmanager
from decimal import Decimal
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from PIL import Image

from apps.products import image_fetch
from apps.products.image_fetch import (
    ImageFetchError,
    fetch_product_image,
    screen_image_url,
)
from apps.products.image_rules import MAX_PRODUCT_IMAGE_BYTES

from .import_contract import PRODUCT_IMPORT_HEADERS
from .models import Product, ProductPacket
from .test_imports import ProductImportTestCase, row

MEDIA_ROOT = tempfile.mkdtemp(prefix="nexapos-test-import-media-")


def image_bytes(fmt="PNG", size=(48, 48), colour=(20, 140, 90)):
    buffer = io.BytesIO()
    Image.new("RGB", size, colour).save(buffer, format=fmt)
    return buffer.getvalue()


# Larger than the shared 5 MB ceiling, built once because every oversized test
# needs the same bytes and generating them repeatedly is pure test latency.
OVERSIZED = b"\x89PNG\r\n\x1a\n" + b"\0" * MAX_PRODUCT_IMAGE_BYTES


class _ImageHandler(BaseHTTPRequestHandler):
    """Serves the fixtures the fetcher tests need, and records every hit."""

    protocol_version = "HTTP/1.1"

    def log_message(self, *args):  # keep the test output clean
        return

    def _send(self, status, body=b"", content_type="image/png", headers=()):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        for name, value in headers:
            self.send_header(name, value)
        self.end_headers()
        if body:
            self.wfile.write(body)

    def _redirect(self, location, status=302):
        self.send_response(status)
        self.send_header("Location", location)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):  # noqa: N802 - BaseHTTPRequestHandler's interface
        path = self.path.split("?")[0]
        self.server.requests.append(path)
        try:
            self._route(path)
        except (BrokenPipeError, ConnectionResetError):
            # Expected whenever the fetcher gives up mid-body, e.g. the
            # oversized-stream case. Not a test failure.
            self.close_connection = True

    def _route(self, path):
        if path == "/milk.png":
            return self._send(200, image_bytes("PNG"))
        if path == "/milk.jpg":
            return self._send(200, image_bytes("JPEG"), "image/jpeg")
        if path == "/milk.webp":
            return self._send(200, image_bytes("WEBP"), "image/webp")
        if path == "/animation.gif":
            # A real, decodable image - just not one of the three allowed
            # formats, so it must fail on format rather than on decoding.
            return self._send(200, image_bytes("GIF"), "image/gif")
        if path == "/page.jpg":
            # The URL says jpg and so does the Content-Type. Only the bytes
            # tell the truth, and they are HTML.
            return self._send(200, b"<html><body>not an image</body></html>", "image/jpeg")
        if path == "/logo.svg":
            body = b'<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>'
            return self._send(200, body, "image/svg+xml")
        if path == "/empty.png":
            return self._send(200, b"")
        if path == "/missing.png":
            return self._send(404, b"gone", "text/plain")
        if path == "/declared-huge.png":
            # Honest Content-Length above the ceiling: must be refused before
            # the body is read at all.
            return self._send(200, OVERSIZED)
        if path == "/stream-huge.png":
            # No Content-Length at all, so only the hard read cap can stop it.
            self.protocol_version = "HTTP/1.0"
            self.send_response(200)
            self.send_header("Content-Type", "image/png")
            self.end_headers()
            self.wfile.write(OVERSIZED)
            self.close_connection = True
            return None
        if path == "/slow.png":
            time.sleep(3)
            return self._send(200, image_bytes("PNG"))
        if path == "/redirect-metadata":
            return self._redirect("http://169.254.169.254/latest/meta-data/")
        if path == "/redirect-relative":
            return self._redirect("/milk.png")
        if path == "/redirect-loop":
            return self._redirect("/redirect-loop")
        if path == "/redirect-empty":
            self.send_response(302)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return None
        return self._send(404, b"unknown", "text/plain")


class ImageServer:
    """A throwaway HTTP server on an ephemeral loopback port."""

    def __init__(self):
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), _ImageHandler)
        self.httpd.requests = []
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()

    @property
    def port(self):
        return self.httpd.server_address[1]

    @property
    def requests(self):
        return self.httpd.requests

    def url(self, path):
        return f"http://127.0.0.1:{self.port}{path}"

    def reset(self):
        self.httpd.requests.clear()

    def stop(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.thread.join(timeout=5)


@contextmanager
def allow_loopback():
    """Relax *only* the address screen, so a test can serve from 127.0.0.1.

    Never used by a test that claims something about SSRF defence - those
    exercise the real screen. This exists so the transfer, redirect and
    content-sniffing paths can be tested against a real server at all.
    """
    with patch.object(image_fetch, "_reject_if_internal", lambda address: None):
        yield


class ImageFetchSecurityTests(TestCase):
    """Direct tests of the fetcher, independent of CSV import."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.server = ImageServer()

    @classmethod
    def tearDownClass(cls):
        cls.server.stop()
        super().tearDownClass()

    def setUp(self):
        self.server.reset()

    def assertNeverContacted(self):
        self.assertEqual(
            self.server.requests,
            [],
            "the URL was rejected only after the request had already been sent",
        )

    # --- scheme -----------------------------------------------------------

    def test_only_http_and_https_schemes_are_accepted(self):
        for url in (
            "file:///etc/passwd",
            "gopher://127.0.0.1:11211/_stats",
            "ftp://example.com/image.png",
            "data:image/png;base64,iVBORw0KGgo=",
            "//example.com/image.png",
            "javascript:alert(1)",
        ):
            with self.subTest(url=url):
                with self.assertRaises(ImageFetchError) as caught:
                    fetch_product_image(url)
                self.assertEqual(caught.exception.code, "IMAGE_URL_SCHEME")

    # --- address screening ------------------------------------------------

    def test_the_live_loopback_server_is_refused_without_being_contacted(self):
        """The strongest form of the SSRF assertion.

        A server really is listening on this exact address and would answer
        with a valid PNG. Nothing reaches it.
        """
        with self.assertRaises(ImageFetchError) as caught:
            fetch_product_image(self.server.url("/milk.png"))
        self.assertEqual(caught.exception.code, "IMAGE_URL_PRIVATE_ADDRESS")
        self.assertNeverContacted()

    def test_private_link_local_and_metadata_addresses_are_refused(self):
        for url in (
            # The cloud metadata endpoint, the reason 169.254.0.0/16 is here.
            "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
            "http://[fd00:ec2::254]/latest/meta-data/",
            "http://127.0.0.1/image.png",
            "http://127.1/image.png",
            "https://[::1]/image.png",
            "http://10.0.0.1/image.png",
            "http://172.16.0.1/image.png",
            "http://172.31.255.254/image.png",
            "http://192.168.1.1/image.png",
            "http://0.0.0.0/image.png",
            "http://[::]/image.png",
            "http://224.0.0.1/image.png",
        ):
            with self.subTest(url=url):
                with self.assertRaises(ImageFetchError) as caught:
                    fetch_product_image(url)
                self.assertEqual(
                    caught.exception.code, "IMAGE_URL_PRIVATE_ADDRESS", url
                )

    def test_public_addresses_pass_the_screen(self):
        """Guards against the screen being so broad it blocks everything.

        A test suite where every URL is rejected would pass all of the above
        while the feature is completely broken.
        """
        with patch.object(
            image_fetch.socket,
            "getaddrinfo",
            return_value=[(2, 1, 6, "", ("93.184.216.34", 80))],
        ):
            screen_image_url("https://cdn.example.com/milk.png")

    def test_a_host_resolving_to_both_public_and_private_is_refused(self):
        """Checking only the first answer would let this through on a retry."""
        with patch.object(
            image_fetch.socket,
            "getaddrinfo",
            return_value=[
                (2, 1, 6, "", ("93.184.216.34", 80)),
                (2, 1, 6, "", ("169.254.169.254", 80)),
            ],
        ):
            with self.assertRaises(ImageFetchError) as caught:
                screen_image_url("http://rebind.example.com/image.png")
        self.assertEqual(caught.exception.code, "IMAGE_URL_PRIVATE_ADDRESS")

    def test_an_unresolvable_host_fails_closed(self):
        with self.assertRaises(ImageFetchError) as caught:
            fetch_product_image("https://nx.invalid./image.png")
        self.assertEqual(caught.exception.code, "IMAGE_HOST_UNRESOLVED")

    def test_dns_rebinding_is_caught_from_the_live_socket(self):
        """Simulates the lookup saying "public" and the connection landing
        on loopback anyway - the TOCTOU window between resolve and connect.

        Only the DNS screen is neutralised here; the peer check is the thing
        under test, and it must fire before a single byte is requested.
        """
        with patch.object(image_fetch, "_resolve_and_screen", lambda host, port: None):
            with self.assertRaises(ImageFetchError) as caught:
                fetch_product_image(self.server.url("/milk.png"))
        self.assertEqual(caught.exception.code, "IMAGE_URL_PRIVATE_ADDRESS")
        self.assertNeverContacted()

    def test_a_redirect_into_the_metadata_endpoint_is_refused(self):
        """Hop 1 is allowed to reach the test server; hop 2 must not pass.

        Only 127.0.0.1 is waved through, standing in for "this host is
        public". The metadata address goes through the untouched screen, and
        is rejected during the second hop's DNS pass - so nothing ever
        attempts to connect to 169.254.169.254.
        """
        with patch.object(image_fetch, "_reject_if_internal", _allow_only_loopback()):
            with self.assertRaises(ImageFetchError) as caught:
                fetch_product_image(self.server.url("/redirect-metadata"))
        self.assertEqual(caught.exception.code, "IMAGE_URL_PRIVATE_ADDRESS")
        self.assertEqual(self.server.requests, ["/redirect-metadata"])

    def test_the_request_timeout_is_bounded_and_short(self):
        self.assertLessEqual(image_fetch.FETCH_TIMEOUT_SECONDS, 10)
        with allow_loopback(), patch.object(image_fetch, "FETCH_TIMEOUT_SECONDS", 1):
            started = time.monotonic()
            with self.assertRaises(ImageFetchError) as caught:
                fetch_product_image(self.server.url("/slow.png"))
            elapsed = time.monotonic() - started
        self.assertEqual(caught.exception.code, "IMAGE_FETCH_FAILED")
        self.assertLess(elapsed, 3, "the fetch did not honour its timeout")

    # --- size, content and redirects --------------------------------------

    def test_valid_images_are_fetched_and_typed_from_their_bytes(self):
        with allow_loopback():
            for path, extension in (
                ("/milk.png", "png"),
                ("/milk.jpg", "jpg"),
                ("/milk.webp", "webp"),
            ):
                with self.subTest(path=path):
                    fetched = fetch_product_image(self.server.url(path))
                    self.assertEqual(fetched.extension, extension)
                    self.assertEqual(fetched.filename, f"import-image.{extension}")
                    self.assertTrue(fetched.content)

    def test_a_declared_oversize_body_is_refused_before_it_is_read(self):
        with allow_loopback():
            with self.assertRaises(ImageFetchError) as caught:
                fetch_product_image(self.server.url("/declared-huge.png"))
        self.assertEqual(caught.exception.code, "IMAGE_TOO_LARGE")

    def test_an_oversize_body_without_a_declared_length_hits_the_read_cap(self):
        with allow_loopback():
            with self.assertRaises(ImageFetchError) as caught:
                fetch_product_image(self.server.url("/stream-huge.png"))
        self.assertEqual(caught.exception.code, "IMAGE_TOO_LARGE")

    def test_content_decides_the_type_not_the_extension_or_header(self):
        with allow_loopback():
            with self.assertRaises(ImageFetchError) as caught:
                fetch_product_image(self.server.url("/page.jpg"))
        self.assertEqual(caught.exception.code, "IMAGE_INVALID_CONTENT")

    def test_svg_is_refused(self):
        """SVG carries script, and the manual upload path refuses it too."""
        with allow_loopback():
            with self.assertRaises(ImageFetchError) as caught:
                fetch_product_image(self.server.url("/logo.svg"))
        self.assertEqual(caught.exception.code, "IMAGE_INVALID_CONTENT")

    def test_a_decodable_but_unsupported_format_is_refused(self):
        with allow_loopback():
            with self.assertRaises(ImageFetchError) as caught:
                fetch_product_image(self.server.url("/animation.gif"))
        self.assertEqual(caught.exception.code, "IMAGE_UNSUPPORTED_FORMAT")

    def test_error_statuses_and_empty_bodies_are_refused(self):
        with allow_loopback():
            for path in ("/missing.png", "/empty.png", "/redirect-empty"):
                with self.subTest(path=path):
                    with self.assertRaises(ImageFetchError) as caught:
                        fetch_product_image(self.server.url(path))
                    self.assertEqual(caught.exception.code, "IMAGE_FETCH_FAILED")

    def test_a_relative_redirect_is_resolved_against_its_hop(self):
        with allow_loopback():
            fetched = fetch_product_image(self.server.url("/redirect-relative"))
        self.assertEqual(fetched.extension, "png")

    def test_a_redirect_loop_is_capped(self):
        with allow_loopback():
            with self.assertRaises(ImageFetchError) as caught:
                fetch_product_image(self.server.url("/redirect-loop"))
        self.assertEqual(caught.exception.code, "IMAGE_FETCH_FAILED")
        self.assertLessEqual(
            len(self.server.requests), image_fetch.MAX_REDIRECTS + 1
        )


def _allow_only_loopback():
    """A screen that waves 127.0.0.1 through and applies the real rules to
    everything else.

    Lets a redirect test reach hop 1 on the local fixture server while the
    genuine screen still judges hop 2.
    """
    real = image_fetch._reject_if_internal

    def screen(address):
        if address == "127.0.0.1":
            return None
        return real(address)

    return screen


@override_settings(MEDIA_ROOT=MEDIA_ROOT)
class ProductImportExtensionTests(ProductImportTestCase):
    """End-to-end CSV import of Secondary Name, Image URL and Packet Sizes.

    Inherits the existing import fixture and helpers so the new columns are
    exercised through exactly the same validate/confirm flow as everything
    else, rather than a parallel harness that could drift.
    """

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.server = ImageServer()

    @classmethod
    def tearDownClass(cls):
        cls.server.stop()
        shutil.rmtree(MEDIA_ROOT, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        super().setUp()
        self.server.reset()
        self.login(self.owner)

    def import_rows(self, *rows, strategy="SKIP", **file_options):
        """Validate then confirm, returning the validation summary."""
        summary = self.validate(*rows, **file_options).json()["data"]
        if summary["can_import"]:
            self.assertEqual(self.confirm(summary["id"], strategy).status_code, 200)
        return summary

    def issues(self, import_id, kind="errors"):
        rows = self.detail(import_id)["rows"]["results"]
        return [issue for entry in rows for issue in entry[kind]]

    def codes(self, import_id, kind="errors"):
        return {issue["error_code"] for issue in self.issues(import_id, kind)}

    # --- template and back-compatibility ----------------------------------

    def test_the_template_carries_the_three_columns_and_still_validates(self):
        template = self.client.get(reverse("products_api:product-import-template"))
        self.assertEqual(template.status_code, 200)
        body = template.content.decode()
        header_line = body.splitlines()[0].lstrip("﻿")
        for column in ("Secondary Name", "Image URL", "Packet Sizes"):
            self.assertIn(column, header_line)

        # The example row must be importable as-is, not just illustrative.
        # Its Image URL is an example.com placeholder, so it may or may not
        # resolve here; either way it is a warning, never a blocked row.
        response = self.validate_file(
            SimpleUploadedFile("template.csv", body.encode(), "text/csv")
        )
        summary = response.json()["data"]
        self.assertTrue(summary["can_import"], self.issues(summary["id"]))
        self.assertEqual(summary["error_rows"], 0)

        # The packet example has to be a working demonstration, not decoration.
        normalized = [
            entry["normalized_data"] for entry in self.detail(summary["id"])["rows"]["results"]
        ]
        self.assertTrue(any(entry["packets"] for entry in normalized))
        self.assertTrue(all(entry["secondary_name"] for entry in normalized))
        # Packet sizes are in the product's own unit, so a fractional example
        # only makes sense on a weighed product.
        fractional = [
            entry
            for entry in normalized
            if any(Decimal(packet["size"]) % 1 for packet in entry["packets"])
        ]
        self.assertTrue(fractional)
        self.assertEqual({entry["unit"] for entry in fractional}, {"KG"})

    def test_a_csv_predating_these_columns_imports_unchanged(self):
        legacy_headers = tuple(
            header
            for header in PRODUCT_IMPORT_HEADERS
            if header not in {"Secondary Name", "Image URL", "Packet Sizes"}
        )
        self.assertEqual(len(legacy_headers), 12)
        summary = self.import_rows(row(), headers=legacy_headers)

        self.assertTrue(summary["can_import"])
        self.assertEqual(summary["warning_rows"], 0)
        product = Product.objects.get(shop=self.shop)
        self.assertEqual(product.secondary_name, "")
        self.assertEqual(product.pricing_mode, Product.PricingMode.STANDARD)
        self.assertFalse(product.image)

    def test_reimporting_through_an_older_template_preserves_what_it_cannot_see(self):
        """The regression this guards: a shop enriches products in the UI,
        then re-imports last month's price file. Columns the file does not
        contain must not be interpreted as "clear this".
        """
        self.import_rows(
            row(**{"Secondary Name": "حليب بلدنا", "Packet Sizes": "1@6.00;2@11.00"})
        )
        product = Product.objects.get(shop=self.shop)
        self.assertEqual(product.packets.count(), 2)

        legacy_headers = tuple(
            header
            for header in PRODUCT_IMPORT_HEADERS
            if header not in {"Secondary Name", "Image URL", "Packet Sizes"}
        )
        self.import_rows(
            row(**{"Selling Price (QAR)": "7.00"}),
            strategy="UPDATE",
            headers=legacy_headers,
        )

        product.refresh_from_db()
        self.assertEqual(product.selling_price, Decimal("7.00"))
        self.assertEqual(product.secondary_name, "حليب بلدنا")
        self.assertEqual(product.pricing_mode, Product.PricingMode.MULTI)
        self.assertEqual(product.packets.count(), 2)

    def test_a_present_but_blank_cell_is_an_explicit_clear(self):
        self.import_rows(
            row(**{"Secondary Name": "حليب بلدنا", "Packet Sizes": "1@6.00"})
        )
        self.import_rows(
            row(**{"Secondary Name": "", "Packet Sizes": ""}), strategy="UPDATE"
        )

        product = Product.objects.get(shop=self.shop)
        self.assertEqual(product.secondary_name, "")
        self.assertEqual(product.pricing_mode, Product.PricingMode.STANDARD)
        self.assertEqual(product.packets.count(), 0)

    # --- Secondary Name ---------------------------------------------------

    def test_a_secondary_name_imports_and_is_served_back(self):
        self.import_rows(row(**{"Secondary Name": "حليب بلدنا ١ لتر"}))

        product = Product.objects.get(shop=self.shop)
        self.assertEqual(product.secondary_name, "حليب بلدنا ١ لتر")

        listed = self.client.get(reverse("products_api:product-list")).json()
        self.assertEqual(
            listed["data"]["results"][0]["secondary_name"], "حليب بلدنا ١ لتر"
        )

    def test_an_overlong_secondary_name_is_a_row_error(self):
        summary = self.validate(row(**{"Secondary Name": "ا" * 201})).json()["data"]
        self.assertFalse(summary["can_import"])
        self.assertIn("VALUE_TOO_LONG", self.codes(summary["id"]))

    # --- Packet Sizes -----------------------------------------------------

    def test_packet_sizes_create_ordered_packets_and_enable_multi_pricing(self):
        self.import_rows(
            row(**{"Unit": "Kg", "Packet Sizes": "0.25@3.50;1@13.00;5 @ 60"})
        )

        product = Product.objects.get(shop=self.shop)
        self.assertEqual(product.pricing_mode, Product.PricingMode.MULTI)
        packets = list(product.packets.order_by("display_order"))
        self.assertEqual(
            [(packet.size, packet.price) for packet in packets],
            [
                (Decimal("0.250"), Decimal("3.50")),
                (Decimal("1.000"), Decimal("13.00")),
                (Decimal("5.000"), Decimal("60.00")),
            ],
        )
        self.assertEqual([packet.display_order for packet in packets], [0, 1, 2])
        self.assertTrue(all(packet.is_active for packet in packets))

    def test_malformed_packet_syntax_names_the_pair_that_failed(self):
        cases = {
            "0.25@3.50;1": "PACKET_MALFORMED_PAIR",
            "0.25@3.50;;1@13.00": "PACKET_EMPTY_PAIR",
            "0.25@3.50;1@2@3": "PACKET_MALFORMED_PAIR",
            "0.25@abc": "INVALID_DECIMAL",
            "abc@3.50": "INVALID_DECIMAL",
            "0@3.50": "PACKET_SIZE_NOT_POSITIVE",
            "-1@3.50": "NEGATIVE_VALUE",
            "0.25@-3.50": "NEGATIVE_VALUE",
            "0.2555@3.50": "DECIMAL_PRECISION",
            "0.25@3.505": "DECIMAL_PRECISION",
            "0.25@3.50;0.250@4.00": "PACKET_DUPLICATE_SIZE",
        }
        for value, expected in cases.items():
            with self.subTest(value=value):
                summary = self.validate(row(**{"Packet Sizes": value})).json()["data"]
                self.assertFalse(summary["can_import"], value)
                self.assertIn(expected, self.codes(summary["id"]))
                # The message has to point at the offending pair, not just say
                # "Packet Sizes is wrong" on a row with several packets.
                messages = " ".join(
                    issue["human_message"] + issue["column"]
                    for issue in self.issues(summary["id"])
                )
                self.assertRegex(messages, r"[Pp]acket")

    def test_a_malformed_packet_column_never_silently_downgrades_the_product(self):
        """A dropped packet would quietly change what the shop can sell, so
        the row must fail rather than import as a plain STANDARD product.
        """
        summary = self.validate(row(**{"Packet Sizes": "0.25@3.50;broken"})).json()[
            "data"
        ]
        self.assertFalse(summary["can_import"])
        self.assertEqual(self.confirm(summary["id"]).status_code, 400)
        self.assertFalse(Product.objects.filter(shop=self.shop).exists())
        self.assertFalse(ProductPacket.objects.exists())

    def test_updating_packets_replaces_the_previous_offer(self):
        self.import_rows(row(**{"Unit": "Kg", "Packet Sizes": "0.25@3.50;1@13.00"}))
        self.import_rows(
            row(**{"Unit": "Kg", "Packet Sizes": "0.5@7.00"}), strategy="UPDATE"
        )

        product = Product.objects.get(shop=self.shop)
        self.assertEqual(
            [packet.size for packet in product.packets.all()], [Decimal("0.500")]
        )

    # --- Image URL --------------------------------------------------------

    def test_an_ssrf_attempt_is_warned_at_validation_and_never_fetched(self):
        """The headline security case, end to end through the import API.

        The loopback URL is the live test server, which would answer with a
        valid PNG. The metadata URL is the address an attacker actually wants.
        Neither is contacted, and neither blocks the row.
        """
        hostile = {
            "metadata": "http://169.254.169.254/latest/meta-data/",
            "loopback": self.server.url("/milk.png"),
            "private": "http://10.0.0.5/logo.png",
            "scheme": "file:///etc/passwd",
        }
        for label, url in hostile.items():
            with self.subTest(target=label):
                sku = f"SSRF-{label.upper()}"
                summary = self.import_rows(row(**{"SKU": sku, "Image URL": url}))

                self.assertTrue(summary["can_import"], "a bad image blocked the row")
                self.assertEqual(summary["warning_rows"], 1)
                self.assertEqual(summary["error_rows"], 0)

                warnings = self.issues(summary["id"], "warnings")
                self.assertEqual([issue["column"] for issue in warnings], ["Image URL"])
                self.assertIn(
                    warnings[0]["error_code"],
                    {"IMAGE_URL_PRIVATE_ADDRESS", "IMAGE_URL_SCHEME"},
                )

                # The rest of the product still imported, without an image.
                product = Product.objects.get(shop=self.shop, sku=sku)
                self.assertEqual(product.name, "Baladna Milk 1L")
                self.assertFalse(product.image)

        self.assertEqual(
            self.server.requests,
            [],
            "an import row reached the loopback server it was meant to be denied",
        )

    def test_a_valid_image_url_is_fetched_at_confirmation_and_served_back(self):
        with allow_loopback():
            summary = self.import_rows(
                row(**{"Image URL": self.server.url("/milk.png")})
            )

        self.assertTrue(summary["can_import"])
        self.assertEqual(summary["warning_rows"], 0)
        self.assertIn("/milk.png", self.server.requests)

        product = Product.objects.get(shop=self.shop)
        self.assertTrue(product.image)
        self.assertIn("product-images/", product.image.name)
        self.assertIn(str(product.pk), product.image.name)

        listed = self.client.get(reverse("products_api:product-list")).json()
        image_url = listed["data"]["results"][0]["image_url"]
        self.assertIsNotNone(image_url)
        self.assertTrue(image_url.startswith("http"), image_url)

    def test_no_image_is_fetched_during_validation(self):
        """Validation must stay free of outbound transfers: a 10,000-row file
        would otherwise turn one upload into 10,000 outbound requests.
        """
        with allow_loopback():
            summary = self.validate(
                row(**{"Image URL": self.server.url("/milk.png")})
            ).json()["data"]

        self.assertTrue(summary["can_import"])
        self.assertEqual(self.server.requests, [])
        # Confirming is what performs the transfer.
        with allow_loopback():
            self.assertEqual(self.confirm(summary["id"]).status_code, 200)
        self.assertEqual(self.server.requests, ["/milk.png"])

    def test_an_unreachable_url_warns_at_confirmation_without_losing_the_product(self):
        with allow_loopback():
            summary = self.import_rows(
                row(**{"Image URL": self.server.url("/missing.png")})
            )

        product = Product.objects.get(shop=self.shop)
        self.assertFalse(product.image)
        self.assertEqual(product.selling_price, Decimal("6.00"))

        warnings = self.issues(summary["id"], "warnings")
        self.assertEqual([issue["error_code"] for issue in warnings], ["IMAGE_FETCH_FAILED"])
        # The summary counter has to agree with the rows, or the detail page
        # shows warnings the header says do not exist.
        detail = self.detail(summary["id"])
        self.assertEqual(detail["warning_rows"], 1)

    def test_a_rejected_payload_warns_rather_than_failing_the_import(self):
        with allow_loopback():
            summary = self.import_rows(
                row(**{"Image URL": self.server.url("/page.jpg")})
            )

        self.assertEqual(
            [issue["error_code"] for issue in self.issues(summary["id"], "warnings")],
            ["IMAGE_INVALID_CONTENT"],
        )
        self.assertFalse(Product.objects.get(shop=self.shop).image)

    def test_an_image_failure_never_rolls_back_the_catalogue(self):
        """Two good rows and one poisoned one: the good products survive."""
        with allow_loopback():
            self.import_rows(
                row(**{"Image URL": self.server.url("/milk.png")}),
                row(
                    **{
                        "Product Name": "Broken Image",
                        "SKU": "BROKEN-1",
                        "Image URL": self.server.url("/declared-huge.png"),
                    }
                ),
                row(**{"Product Name": "No Image", "SKU": "PLAIN-1"}),
            )

        self.assertEqual(Product.objects.filter(shop=self.shop).count(), 3)
        self.assertTrue(Product.objects.get(sku="MILK-IMPORT-1").image)
        self.assertFalse(Product.objects.get(sku="BROKEN-1").image)

    # --- all three together -----------------------------------------------

    def test_all_three_columns_on_one_product_end_to_end(self):
        """The use case that motivated the work: a Qatari grocer importing a
        catalogue with Arabic names, packet pricing and product photos.
        """
        with allow_loopback():
            summary = self.import_rows(
                row(
                    **{
                        "Product Name": "Basmati Rice",
                        "SKU": "RICE-IMPORT-1",
                        "Category": "Grains",
                        "Unit": "Kg",
                        "Purchase Price (QAR)": "9.00",
                        "Selling Price (QAR)": "12.00",
                        "Opening Quantity": "40.000",
                        "Secondary Name": "أرز بسمتي",
                        "Image URL": self.server.url("/milk.jpg"),
                        "Packet Sizes": "0.25@3.50;1@13.00",
                    }
                )
            )

        self.assertTrue(summary["can_import"])
        self.assertEqual(summary["error_rows"], 0)
        self.assertEqual(summary["warning_rows"], 0)

        product = Product.objects.get(shop=self.shop, sku="RICE-IMPORT-1")
        self.assertEqual(product.secondary_name, "أرز بسمتي")
        self.assertEqual(product.pricing_mode, Product.PricingMode.MULTI)
        self.assertEqual(
            [(packet.size, packet.price) for packet in product.packets.order_by("display_order")],
            [(Decimal("0.250"), Decimal("3.50")), (Decimal("1.000"), Decimal("13.00"))],
        )
        self.assertTrue(product.image)
        self.assertEqual(product.inventory_balance.quantity_on_hand, Decimal("40.000"))

        # And all three survive the round trip back out of the API, which is
        # what billing and the catalogue actually read.
        payload = self.client.get(reverse("products_api:product-list")).json()
        served = next(
            item for item in payload["data"]["results"] if item["sku"] == "RICE-IMPORT-1"
        )
        self.assertEqual(served["secondary_name"], "أرز بسمتي")
        self.assertEqual(served["pricing_mode"], "MULTI")
        self.assertEqual(len(served["packets"]), 2)
        self.assertIsNotNone(served["image_url"])
