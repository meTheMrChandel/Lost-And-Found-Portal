"""
adminpanel/models.py — Admin-specific models: PostAuditLog, AdminInvite.
"""

import uuid

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.posts.models import Post


class PostAuditLog(models.Model):
    """Immutable record of every admin action on a post."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="audit_logs")
    admin = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="post_audit_logs",
    )
    action = models.CharField(_("action"), max_length=50)
    previous_status = models.CharField(_("previous status"), max_length=20, blank=True)
    new_status = models.CharField(_("new status"), max_length=20, blank=True)
    notes = models.TextField(_("notes"), blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("post audit log")
        verbose_name_plural = _("post audit logs")
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"AuditLog(post={self.post_id}, {self.action})"


class AdminInvite(models.Model):
    """One-time invite link to create an admin account."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    token = models.UUIDField(default=uuid.uuid4, unique=True)
    email = models.EmailField(_("invited email"), unique=True)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="sent_invites",
    )
    is_used = models.BooleanField(_("used"), default=False)
    used_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("admin invite")
        verbose_name_plural = _("admin invites")

    def __str__(self) -> str:
        return f"AdminInvite({self.email}, used={self.is_used})"
