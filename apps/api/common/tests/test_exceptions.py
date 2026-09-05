from rest_framework.exceptions import NotFound, Throttled, ValidationError

from common.exceptions import exception_handler


def test_validation_error_shape():
    exc = ValidationError({"email": ["Taken."], "non_field_errors": ["Bad combo."]})
    response = exception_handler(exc, {})
    assert response is not None
    assert response.data == {"error": "Bad combo.", "fields": {"email": ["Taken."]}}


def test_plain_error_shape():
    response = exception_handler(NotFound("Missing."), {})
    assert response is not None
    assert response.data == {"error": "Missing."}


def test_throttle_message():
    response = exception_handler(Throttled(wait=5), {})
    assert response is not None
    assert response.status_code == 429
    assert "Too many attempts" in response.data["error"]
