"""
chat/models.py — Admin-mediated messaging between users.

Phase 8: WebSocket + REST, read receipts, unread counts, block/report.
"""

import uuid

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.matching.models import Match


class Conversation(models.Model):
    """
    A conversation thread tied to a match case.

    Admin-mediated: initially only owner ↔ admin and finder ↔ admin.
    Direct owner ↔ finder chat only after admin approval.
    """

    class ConversationType(models.TextChoices):
        OWNER_ADMIN = "owner_admin", _("Owner ↔ Admin")
        FINDER_ADMIN = "finder_admin", _("Finder ↔ Admin")
        DIRECT = "direct", _("Direct (owner ↔ finder, admin-approved)")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    match = models.ForeignKey(
        Match,
        on_delete=models.CASCADE,
        related_name="conversations",
        null=True,
        blank=True,
    )
    conversation_type = models.CharField(
        _("type"), max_length=20, choices=ConversationType.choices
    )
    participants = models.ManyToManyField(
        settings.AUTH_USER_MODEL, related_name="conversations"
    )
    is_direct_approved = models.BooleanField(
        _("direct chat approved"), default=False
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("conversation")
        verbose_name_plural = _("conversations")

    def __str__(self) -> str:
        return f"Conversation({self.conversation_type}, match={self.match_id})"


class Message(models.Model):
    """A single chat message."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="messages"
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="sent_messages",
    )
    content = models.TextField(_("content"))
    is_read = models.BooleanField(_("read"), default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("message")
        verbose_name_plural = _("messages")
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["conversation", "created_at"], name="idx_msg_conv"),
        ]

    def __str__(self) -> str:
        return f"Message from {self.sender} at {self.created_at}"


class BlockedUser(models.Model):
    """User block list."""

    blocker = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="blocked_users",
    )
    blocked = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="blocked_by",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("blocker", "blocked")]
        verbose_name = _("blocked user")
        verbose_name_plural = _("blocked users")
