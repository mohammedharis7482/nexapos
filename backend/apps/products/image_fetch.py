"""Server-side image fetching for CSV import.

CSV cannot carry binary, so an "Image URL" column means the server makes an
outbound request on the importer's behalf. That is a classic SSRF surface: the
URL is fully attacker-controlled, and the server sits inside a private network
with access to cloud metadata endpoints.

The controls here, in order of application:

1. Scheme must be http or https. Blocks file://, gopher://, ftp://, data: and
   anything else that could read local resources or reach odd protocols.
2. Every address the hostname resolves to is rejected if it is loopback,
   private, link-local, reserved, multicast, or unspecified. `ipaddress`
   covers the ranges named in the spec (127.0.0.0/8, 10.0.0.0/8,
   172.16.0.0/12, 192.168.0.0/16, and 169.254.0.0/16 - the cloud metadata
   endpoint) and their IPv6 equivalents, which a hand-written CIDR list
   usually misses.
3. The address actually connected to is re-checked from the live socket
   before any response is read. This is what closes DNS rebinding: a name
   that resolved public but flipped to 169.254.169.254 before connect is
   caught here, not trusted from the earlier lookup.
4. Redirects are followed manually, capped, and each hop repeats 1-3. A
   public URL that 302s to the metadata endpoint gains nothing.
5. The body is read with a hard cap, so a server streaming forever cannot
   exhaust memory. Content-Length is used as an early reject when present but
   never trusted as the only limit.
6. The bytes are decoded with Pillow and the *detected* format checked, so a
   .jpg URL serving HTML or an SVG is rejected on content, exactly as the
   manual upload path does.

Size and format limits are imported from `image_rules`, the same constants the
manual upload endpoint enforces, so the two paths cannot drift apart.
"""

import http.client
import ipaddress
import socket
from dataclasses import dataclass
from io import BytesIO
from urllib.parse import urljoin, urlparse, urlunparse

from PIL import Image, UnidentifiedImageError

from .image_rules import (
    ALLOWED_PRODUCT_IMAGE_FORMATS,
    MAX_PRODUCT_IMAGE_BYTES,
    PRODUCT_IMAGE_EXTENSIONS,
)

ALLOWED_SCHEMES = frozenset({"http", "https"})
FETCH_TIMEOUT_SECONDS = 5
MAX_REDIRECTS = 3
# Read slightly past the limit so an oversized body is detected rather than
# silently truncated into something that happens to decode.
_READ_CAP = MAX_PRODUCT_IMAGE_BYTES + 1


class ImageFetchError(Exception):
    """A URL that cannot become a product image, with a cashier-readable why."""

    def __init__(self, message: str, *, code: str):
        self.message = message
        self.code = code
        super().__init__(message)


@dataclass(frozen=True)
class FetchedImage:
    content: bytes
    extension: str

    @property
    def filename(self) -> str:
        return f"import-image.{self.extension}"


def _reject_if_internal(address: str) -> None:
    try:
        ip = ipaddress.ip_address(address)
    except ValueError as exc:  # pragma: no cover - getaddrinfo returns valid IPs
        raise ImageFetchError(
            "The image host could not be resolved.", code="IMAGE_HOST_UNRESOLVED"
        ) from exc
    if (
        ip.is_loopback
        or ip.is_private
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    ):
        raise ImageFetchError(
            "Image URLs may not point at private or internal addresses.",
            code="IMAGE_URL_PRIVATE_ADDRESS",
        )


def _validate_url(url: str) -> tuple[str, str, int, str]:
    parsed = urlparse(url)
    if parsed.scheme.lower() not in ALLOWED_SCHEMES:
        raise ImageFetchError(
            "Image URLs must start with http:// or https://.",
            code="IMAGE_URL_SCHEME",
        )
    if not parsed.hostname:
        raise ImageFetchError("Image URL is not a valid address.", code="IMAGE_URL_INVALID")
    scheme = parsed.scheme.lower()
    port = parsed.port or (443 if scheme == "https" else 80)
    path = urlunparse(("", "", parsed.path or "/", parsed.params, parsed.query, ""))
    return scheme, parsed.hostname, port, path


def _resolve_and_screen(hostname: str, port: int) -> None:
    """Reject the host if *any* address it resolves to is internal.

    Any, not just the first: a name resolving to both a public and a private
    address would otherwise be reachable on a retry.
    """
    try:
        infos = socket.getaddrinfo(hostname, port, proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        raise ImageFetchError(
            "The image host could not be resolved.", code="IMAGE_HOST_UNRESOLVED"
        ) from exc
    for info in infos:
        _reject_if_internal(info[4][0])


def screen_image_url(url: str) -> None:
    """Deterministic vetting with no network transfer.

    Run at CSV validation time so an SSRF attempt is reported in the preview,
    where the importer sees it, rather than silently at confirmation.
    """
    _, hostname, port, _ = _validate_url(url)
    _resolve_and_screen(hostname, port)


def _open(scheme: str, hostname: str, port: int, path: str) -> http.client.HTTPResponse:
    connection_class = (
        http.client.HTTPSConnection if scheme == "https" else http.client.HTTPConnection
    )
    connection = connection_class(hostname, port, timeout=FETCH_TIMEOUT_SECONDS)
    try:
        connection.connect()
        # The address actually reached, not the one looked up a moment ago.
        # This is the DNS-rebinding guard; nothing is read before it passes.
        peer = connection.sock.getpeername()[0]
        _reject_if_internal(peer)
        connection.request(
            "GET", path, headers={"Host": hostname, "User-Agent": "NexaPOS-Import"}
        )
        return connection.getresponse()
    except ImageFetchError:
        connection.close()
        raise
    except (OSError, http.client.HTTPException) as exc:
        connection.close()
        raise ImageFetchError(
            "The image could not be downloaded.", code="IMAGE_FETCH_FAILED"
        ) from exc


def fetch_product_image(url: str) -> FetchedImage:
    """Download and validate an image, or raise ImageFetchError.

    Callers treat every failure as non-fatal: the product imports without an
    image rather than the row failing.
    """
    target = url
    for _ in range(MAX_REDIRECTS + 1):
        scheme, hostname, port, path = _validate_url(target)
        _resolve_and_screen(hostname, port)
        response = _open(scheme, hostname, port, path)
        try:
            if response.status in (301, 302, 303, 307, 308):
                location = response.getheader("Location")
                if not location:
                    raise ImageFetchError(
                        "The image URL redirected without a destination.",
                        code="IMAGE_FETCH_FAILED",
                    )
                # Location may be relative (RFC 7231 permits it), so resolve
                # it against the hop it came from. The loop then re-runs
                # scheme, DNS and peer screening on the result, so a public
                # URL cannot bounce into the private range.
                target = urljoin(target, location)
                continue
            if response.status != 200:
                raise ImageFetchError(
                    f"The image URL returned HTTP {response.status}.",
                    code="IMAGE_FETCH_FAILED",
                )
            declared = response.getheader("Content-Length")
            if declared and declared.isdigit() and int(declared) > MAX_PRODUCT_IMAGE_BYTES:
                raise ImageFetchError(
                    "Images must be 5 MB or smaller.", code="IMAGE_TOO_LARGE"
                )
            content = response.read(_READ_CAP)
        finally:
            response.close()

        if len(content) > MAX_PRODUCT_IMAGE_BYTES:
            raise ImageFetchError(
                "Images must be 5 MB or smaller.", code="IMAGE_TOO_LARGE"
            )
        if not content:
            raise ImageFetchError(
                "The image URL returned no data.", code="IMAGE_FETCH_FAILED"
            )
        # Content decides the type, never the URL's extension or the server's
        # Content-Type header - both are attacker-controlled.
        try:
            with Image.open(BytesIO(content)) as probe:
                probe.verify()
                detected = probe.format
        except (UnidentifiedImageError, OSError) as exc:
            raise ImageFetchError(
                "The URL did not return a valid image.", code="IMAGE_INVALID_CONTENT"
            ) from exc
        if detected not in ALLOWED_PRODUCT_IMAGE_FORMATS:
            raise ImageFetchError(
                "Linked images must be JPG, PNG, or WEBP.",
                code="IMAGE_UNSUPPORTED_FORMAT",
            )
        return FetchedImage(content=content, extension=PRODUCT_IMAGE_EXTENSIONS[detected])

    raise ImageFetchError(
        "The image URL redirected too many times.", code="IMAGE_FETCH_FAILED"
    )
