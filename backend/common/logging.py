import json
import logging
from datetime import UTC, datetime


class SafeJsonFormatter(logging.Formatter):
    """Emit structured operational fields while excluding request payloads."""

    safe_extra_fields = ("request_id", "path", "user_id", "shop_id")

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for field in self.safe_extra_fields:
            value = getattr(record, field, None)
            if value is not None:
                payload[field] = str(value)
        if record.exc_info:
            payload["exception_type"] = record.exc_info[0].__name__
        return json.dumps(payload, ensure_ascii=True)
