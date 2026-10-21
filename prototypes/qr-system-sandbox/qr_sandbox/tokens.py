"""Item tokens: random UUID4 strings that identify a registered item (FR-QR-2)."""

import uuid

from .errors import InvalidTokenError


def new_item_token() -> str:
    """Return a fresh random token. It carries no personal data."""
    return str(uuid.uuid4())


def is_valid_token(value) -> bool:
    """True only for canonical, hyphenated UUID4 strings."""
    if not isinstance(value, str):
        return False
    try:
        parsed = uuid.UUID(value)
    except ValueError:
        return False
    return parsed.version == 4 and str(parsed) == value.lower()


def normalize_token(value) -> str:
    """Validate and lower-case a token, or raise InvalidTokenError."""
    if not is_valid_token(value):
        raise InvalidTokenError(f"not a valid item token: {value!r}")
    return value.lower()
