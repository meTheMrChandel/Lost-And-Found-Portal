"""Search owners by name or registration number (FR-MSG-1). Public fields only."""

from typing import Dict, List

from .models import Owner
from .privacy import public_owner_view

MIN_QUERY_LENGTH = 2


class OwnerDirectory:
    def __init__(self):
        self._owners: Dict[str, Owner] = {}

    def add(self, owner: Owner) -> None:
        self._owners[owner.owner_id] = owner

    def search(self, query: str, limit: int = 10) -> List[dict]:
        q = (query or "").strip().lower()
        if len(q) < MIN_QUERY_LENGTH:
            return []
        scored = []
        for owner in self._owners.values():
            reg, name = owner.registration_no.lower(), owner.name.lower()
            if reg == q:
                rank = 0
            elif reg.startswith(q):
                rank = 1
            elif name.startswith(q) or any(w.startswith(q) for w in name.split()):
                rank = 2
            elif q in name:
                rank = 3
            else:
                continue
            scored.append((rank, name, owner))
        scored.sort(key=lambda t: (t[0], t[1]))
        return [
            {"owner_id": o.owner_id, **public_owner_view(o)} for _, _, o in scored[:limit]
        ]
