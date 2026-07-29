import logging
from dataclasses import dataclass
from enum import StrEnum

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

logger = logging.getLogger("nexapos.email")


class DeliveryStatus(StrEnum):
    SENT = "EMAIL_SENT"
    CONSOLE = "DEVELOPMENT_CONSOLE"
    FAILED = "EMAIL_DELIVERY_FAILED"


@dataclass(frozen=True)
class DeliveryResult:
    status: DeliveryStatus
    error_category: str | None = None

    @property
    def delivered(self) -> bool:
        return self.status is not DeliveryStatus.FAILED


def configured_delivery_status() -> DeliveryStatus:
    if settings.EMAIL_BACKEND == "django.core.mail.backends.console.EmailBackend":
        return DeliveryStatus.CONSOLE
    return DeliveryStatus.SENT


def send_templated_email(
    *,
    event: str,
    subject: str,
    recipient: str,
    template: str,
    context: dict,
    user_id: object | None = None,
    shop_id: object | None = None,
) -> DeliveryResult:
    """Send one action email and return only safe operational metadata."""
    backend_name = settings.EMAIL_BACKEND
    try:
        text = render_to_string(f"emails/{template}.txt", context)
        html = render_to_string(f"emails/{template}.html", context)
        message = EmailMultiAlternatives(
            subject, text, settings.DEFAULT_FROM_EMAIL, [recipient]
        )
        message.attach_alternative(html, "text/html")
        sent = message.send(fail_silently=False)
        if sent != 1:
            raise RuntimeError("Email backend did not accept the message.")
    except Exception as exc:
        logger.warning(
            "email_delivery event=%s user_id=%s shop_id=%s backend=%s status=failed "
            "exception_category=%s",
            event,
            user_id,
            shop_id,
            backend_name,
            type(exc).__name__,
        )
        return DeliveryResult(DeliveryStatus.FAILED, type(exc).__name__)

    status = configured_delivery_status()
    logger.info(
        "email_delivery event=%s user_id=%s shop_id=%s backend=%s status=%s",
        event,
        user_id,
        shop_id,
        backend_name,
        status.value,
    )
    return DeliveryResult(status)
