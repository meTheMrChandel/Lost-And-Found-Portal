"""What a stranger who scans a QR is allowed to see (FR-QR-4, FR-QR-5, NFR-4)."""

from .constants import PRIVATE_OWNER_FIELDS
from .models import Owner


def public_owner_view(owner: Owner) -> dict:
    """Name and registration number only. Never phone or email."""
    return {"name": owner.name, "registration_no": owner.registration_no}
