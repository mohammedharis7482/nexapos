from rest_framework import serializers


def parse_bool_param(value: str) -> bool | None:
    """Parse a "true"/"false" query param case-insensitively.

    Returns None for anything else (including an empty string), meaning
    "no filter" rather than an error - callers treat this as optional.
    """
    normalized = value.strip().lower()
    if normalized in {"true", "false"}:
        return normalized == "true"
    return None


def parse_uuid_query_param(request, name: str) -> str:
    """Read an optional UUID query param, validating it if present.

    Returns "" when the param is absent, matching how callers already
    treat an empty value as "no filter".
    """
    value = request.query_params.get(name, "")
    if not value:
        return ""
    try:
        return str(serializers.UUIDField().run_validation(value))
    except serializers.ValidationError as exc:
        raise serializers.ValidationError({name: exc.detail}) from exc
