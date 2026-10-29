"""
adminpanel/models.py — Admin-specific models: PostAuditLog, AdminInvite.
"""

import uuid

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.posts.models import Post


class ImmutableAuditLogError(RuntimeError):
    """Raised on any attempt to change or delete a written audit log entry."""


class PostAuditLogQuerySet(models.QuerySet):
    """Audit entries are append-only, so bulk updates and deletes are refused."""

    def update(self, **kwargs):
        raise ImmutableAuditLogError("Audit log entries cannot be changed.")

    def delete(self):
        raise ImmutableAuditLogError("Audit log entries cannot be deleted.")


class PostAuditLog(models.Model):
    """
    Immutable record of every status change and admin action on a post.

    Entries outlive the post: deleting a post only clears the foreign key, and
    post_ref / post_title keep a copy of which post it was.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(
        Post,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    post_ref = models.UUIDField(_("post id"), null=True, blank=True, db_index=True, editable=False)
    post_title = models.CharField(_("post title"), max_length=200, blank=True, editable=False)
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

    objects = PostAuditLogQuerySet.as_manager()

    class Meta:
        verbose_name = _("post audit log")
        verbose_name_plural = _("post audit logs")
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"AuditLog(post={self.post_ref}, {self.action})"

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ImmutableAuditLogError("Audit log entries cannot be changed once written.")
        if self.post_id:
            self.post_ref = self.post_id
            self.post_title = self.post.title
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ImmutableAuditLogError("Audit log entries cannot be deleted.")


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
