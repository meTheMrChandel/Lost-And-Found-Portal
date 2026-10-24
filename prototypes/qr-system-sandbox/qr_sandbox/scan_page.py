"""Data behind the public scan page that a Finder or Guest sees (FR-QR-4)."""

from .errors import QRInactiveError
from .models import Item
from .privacy import public_owner_view


LOST_BANNER = "The owner has reported this item as lost. Please message them."


def build_scan_payload(item: Item) -> dict:
    """JSON-ready description of the scan page for one item."""
    if not item.qr_active:
        raise QRInactiveError("this QR code has been deactivated by its owner")
    return {
        "item": {"id": item.token, "name": item.name, "category": item.category},
        "owner": public_owner_view(item.owner),
        "highlight_lost": item.is_marked_lost,
        "banner": LOST_BANNER if item.is_marked_lost else None,
        "actions": [
            {
                "id": "message_owner",
                "label": "Message owner",
                "requires_login": True,
            }
        ],
    }
