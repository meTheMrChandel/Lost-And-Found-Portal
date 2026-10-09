"""
items/models.py — QR-registered items (Phase 7).

Users register valuable items and get a QR sticker with a UUID link.
Public scan page shows only item + owner name (no personal data).
"""

import uuid

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.posts.models import Category


class RegisteredItem(models.Model):
    """A valuable item registered by a user for QR identification."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="registered_items",
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="registered_items",
    )
    name = models.CharField(_("item name"), max_length=200)
    description = models.TextField(_("description"), blank=True)
    serial_number = models.CharField(_("serial number"), max_length=100, blank=True)

    # QR link uses this UUID — never exposes owner's personal data
    qr_uuid = models.UUIDField(_("QR UUID"), default=uuid.uuid4, unique=True, editable=False)
    is_active = models.BooleanField(_("QR active"), default=True)
    deactivated_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("registered item")
        verbose_name_plural = _("registered items")
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["qr_uuid"], name="idx_qr_uuid"),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.owner})"

    @property
    def public_qr_data(self) -> dict:
        """Fields shown on the public QR scan page."""
        return {
            "item_name": self.name,
            "category": self.category.name,
            "owner_name": self.owner.full_name,
            "qr_uuid": str(self.qr_uuid),
            "is_active": self.is_active,
        }
