"""In-memory item registry (FR-QR-1)."""

from datetime import datetime, timezone
from typing import Callable, Dict

from .constants import ALLOWED_CATEGORIES, MAX_ITEM_NAME_LENGTH
from .errors import ItemNotFoundError, ValidationError
from .models import Item, Owner
from .tokens import new_item_token, normalize_token


class ItemRegistry:
    def __init__(
        self,
        token_factory: Callable[[], str] = new_item_token,
        clock: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
    ):
        self._items: Dict[str, Item] = {}
        self._token_factory = token_factory
        self._clock = clock

    def register(self, owner: Owner, name: str, category: str) -> Item:
        """Register an item and give it a unique token."""
        name = (name or "").strip()
        if not name:
            raise ValidationError("item name is required")
        if len(name) > MAX_ITEM_NAME_LENGTH:
            raise ValidationError(f"item name is longer than {MAX_ITEM_NAME_LENGTH}")
        if category not in ALLOWED_CATEGORIES:
            raise ValidationError(f"unknown category: {category!r}")
        token = self._token_factory()
        while token in self._items:  # astronomically unlikely, but cheap to guard
            token = self._token_factory()
        item = Item(
            token=token, owner=owner, name=name, category=category,
            created_at=self._clock(),
        )
        self._items[token] = item
        return item

    def get(self, token: str) -> Item:
        item = self._items.get(normalize_token(token))
        if item is None:
            raise ItemNotFoundError(token)
        return item
