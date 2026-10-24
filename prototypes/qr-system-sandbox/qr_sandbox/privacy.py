"""What a stranger who scans a QR is allowed to see (FR-QR-4, FR-QR-5, NFR-4)."""

from .constants import PRIVATE_OWNER_FIELDS
from .models import Owner


def public_owner_view(owner: Owner) -> dict:
    """Name and registration number only. Never phone or email."""
    return {"name": owner.name, "registration_no": owner.registration_no}


def leaks_private_data(payload, owner: Owner) -> bool:
    """True if any private owner value appears anywhere in a JSON-like payload."""
    import json

    text = json.dumps(payload, default=str).lower()
    for field_name in PRIVATE_OWNER_FIELDS:
        value = getattr(owner, field_name, None)
        if value and str(value).lower() in text:
            return True
    return False
