"""Plain data classes used by the prototype (no ORM)."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional


@dataclass(frozen=True)
class Owner:
    owner_id: str
    name: str
    registration_no: str
    email: str
    phone: Optional[str] = None


@dataclass
class Item:
    token: str
    owner: Owner
    name: str
    category: str
    qr_active: bool = True
    is_marked_lost: bool = False
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
