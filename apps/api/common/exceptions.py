from typing import Any

from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


def _flatten(detail: Any) -> list[str]:
    if isinstance(detail, dict):
        return [msg for value in detail.values() for msg in _flatten(value)]
    if isinstance(detail, list | tuple):
        return [msg for value in detail for msg in _flatten(value)]
    return [str(detail)]


def exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    """Reshape every DRF error into {"error": str, "fields"?: {name: [msgs]}}."""
    response = drf_exception_handler(exc, context)
    if response is None:
        return None

    if isinstance(exc, exceptions.ValidationError) and isinstance(exc.detail, dict):
        fields = {
            name: _flatten(messages)
            for name, messages in exc.detail.items()
            if name != "non_field_errors"
        }
        non_field = _flatten(exc.detail.get("non_field_errors", []))
        first_field = next(iter(fields.values()), [])
        message = (
            non_field[0] if non_field else (first_field[0] if first_field else "Invalid input.")
        )
        response.data = {"error": message, "fields": fields}
        return response

    messages = _flatten(getattr(exc, "detail", str(exc)))
    if response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
        messages = ["Too many attempts. Please wait a moment and try again."]
    response.data = {"error": messages[0] if messages else "Something went wrong."}
    return response
