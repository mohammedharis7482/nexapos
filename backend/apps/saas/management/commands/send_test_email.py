from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email
from django.core.exceptions import ValidationError

from apps.saas.email_service import DeliveryStatus, send_templated_email


class Command(BaseCommand):
    help = "Send a token-free test message using the configured development email backend."

    def add_arguments(self, parser):
        parser.add_argument("--to", required=True)

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("This command is disabled outside development settings.")
        try:
            validate_email(options["to"])
        except ValidationError as exc:
            raise CommandError("Provide a valid recipient email address.") from exc

        self.stdout.write("Email delivery attempted.")
        result = send_templated_email(
            event="test_email",
            subject="NexaPOS email delivery test",
            recipient=options["to"],
            template="test_email",
            context={},
        )
        messages = {
            DeliveryStatus.CONSOLE: "Console backend accepted the test message.",
            DeliveryStatus.SENT: "Configured delivery backend accepted the test message.",
            DeliveryStatus.FAILED: (
                f"Delivery failed ({result.error_category or 'unknown category'})."
            ),
        }
        self.stdout.write(messages[result.status])
        if result.status is DeliveryStatus.FAILED:
            raise CommandError("Test email delivery failed.")
