"""Custom DRF exception handler that returns a consistent error envelope.

All error responses follow the format:
    {
        "success": false,
        "code": "error_code",
        "message": "Human-readable message",
        "errors": { ... }   # field-level errors when available
    }
"""

from rest_framework.views import exception_handler


def _messages(value) -> list[str]:
    """Flatten DRF error detail into readable strings.

    Nested serializers report errors as lists of dicts (one per item, empty when that
    item is fine); str() of those would leak Python reprs like "ErrorDetail(...)".
    """
    if isinstance(value, dict):
        return [
            f"{field.replace('_', ' ').capitalize()}: {message}"
            for field, inner in value.items()
            for message in _messages(inner)
        ]
    if isinstance(value, (list, tuple)):
        return [message for item in value for message in _messages(item)]
    return [str(value)]


def custom_exception_handler(exc, context):
    """Wrap DRF default response in the project error envelope."""
    response = exception_handler(exc, context)

    if response is not None:
        detail = response.data

        # Normalise the detail into a flat structure
        if isinstance(detail, dict):
            # May have 'detail' key (authentication errors) or field errors
            code = "validation_error"
            if "detail" in detail and len(detail) == 1:
                message = str(detail["detail"])
                code = getattr(detail.get("detail"), "code", "error")
                errors = {}
            else:
                message = "Validation failed. Please check the errors."
                errors = {field: _messages(err_list) for field, err_list in detail.items()}
        elif isinstance(detail, list):
            code = "error"
            message = " ".join(str(e) for e in detail)
            errors = {}
        else:
            code = "error"
            message = str(detail)
            errors = {}

        response.data = {
            "success": False,
            "code": code,
            "message": message,
            "errors": errors,
        }

    return response
