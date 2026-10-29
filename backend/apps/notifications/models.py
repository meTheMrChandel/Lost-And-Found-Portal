"""
notifications/models.py — In-app, email and FCM notifications.
"""

import uuid

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class Notification(models.Model):
    """In-app notification record."""

    class NotifType(models.TextChoices):
        POST_APPROVED = "post_approved", _("Post approved")
        POST_REJECTED = "post_rejected", _("Post rejected")
        INFO_REQUESTED = "info_requested", _("More info requested")
        MATCH_FOUND = "match_found", _("Match found")
        HANDOVER_READY = "handover_ready", _("Handover ready")
        REWARD_RECORDED = "reward_recorded", _("Reward recorded")
        POST_EXPIRING = "post_expiring", _("Post expiring soon")
        POST_EXPIRED = "post_expired", _("Post expired")
        GENERAL = "general", _("General")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    notif_type = models.CharField(
        _("type"), max_length=30, choices=NotifType.choices, default=NotifType.GENERAL
    )
    title = models.CharField(_("title"), max_length=200)
    body = models.TextField(_("body"))
    data = models.JSONField(_("extra data"), default=dict, blank=True)
    is_read = models.BooleanField(_("read"), default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("notification")
        verbose_name_plural = _("notifications")
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "is_read"], name="idx_notif_unread"),
        ]

    def __str__(self) -> str:
        return f"Notif({self.notif_type}) → {self.recipient}"
