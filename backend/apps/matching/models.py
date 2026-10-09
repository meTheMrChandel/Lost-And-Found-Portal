"""
matching/models.py — Match pairs between LOST and FOUND posts.

Match lifecycle:
    Suggested → Confirmed → Proof pending → Verified → Handed over → Closed
                                                      ↘ Dismissed
"""

import uuid

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.posts.models import Post


class Match(models.Model):
    """Links a LOST post to a FOUND post with a confidence score."""

    class Status(models.TextChoices):
        SUGGESTED = "suggested", _("Suggested")
        CONFIRMED = "confirmed", _("Confirmed")
        PROOF_PENDING = "proof_pending", _("Proof pending")
        VERIFIED = "verified", _("Verified")
        HANDED_OVER = "handed_over", _("Handed over")
        CLOSED = "closed", _("Closed")
        DISMISSED = "dismissed", _("Dismissed")

    class MeetingMode(models.TextChoices):
        DIRECT = "direct", _("Direct meet")
        OFFICE = "office", _("Via admin / security office")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lost_post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name="lost_matches",
        limit_choices_to={"post_type": "LOST"},
    )
    found_post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name="found_matches",
        limit_choices_to={"post_type": "FOUND"},
    )

    # ── Scoring ───────────────────────────────────────────────────────────────
    score = models.FloatField(
        _("match score"),
        default=0.0,
        help_text=_("0.0 – 1.0; pairs above threshold go to admin queue."),
    )

    # ── Status ────────────────────────────────────────────────────────────────
    status = models.CharField(
        _("status"),
        max_length=20,
        choices=Status.choices,
        default=Status.SUGGESTED,
        db_index=True,
    )
    meeting_mode = models.CharField(
        _("meeting mode"),
        max_length=10,
        choices=MeetingMode.choices,
        blank=True,
    )

    # ── Proof Q&A ─────────────────────────────────────────────────────────────
    proof_questions = models.JSONField(
        _("proof questions"),
        default=list,
        help_text=_("List of {question, answer} dicts recorded by admin."),
    )
    proof_verified_at = models.DateTimeField(null=True, blank=True)

    # ── Handover ──────────────────────────────────────────────────────────────
    handover_code_hash = models.CharField(
        _("handover code hash"), max_length=64, blank=True
    )
    handover_code_used = models.BooleanField(_("handover code used"), default=False)
    handed_over_at = models.DateTimeField(null=True, blank=True)

    # ── Reward ────────────────────────────────────────────────────────────────
    reward_amount_settled = models.DecimalField(
        _("reward settled (₹)"), max_digits=8, decimal_places=2, null=True, blank=True
    )
    reward_settled_at = models.DateTimeField(null=True, blank=True)

    # ── Admin ─────────────────────────────────────────────────────────────────
    admin_notes = models.TextField(_("admin notes"), blank=True)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_matches",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("match")
        verbose_name_plural = _("matches")
        ordering = ["-score", "-created_at"]
        unique_together = [("lost_post", "found_post")]
        indexes = [
            models.Index(fields=["status", "-created_at"], name="idx_match_status"),
        ]

    def __str__(self) -> str:
        return f"Match({self.lost_post_id} ↔ {self.found_post_id}, score={self.score:.2f})"


class MatchAuditLog(models.Model):
    """Immutable log of every admin action on a match."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name="audit_logs")
    admin = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="match_audit_logs",
    )
    action = models.CharField(_("action"), max_length=50)
    from_status = models.CharField(_("from status"), max_length=20, blank=True)
    to_status = models.CharField(_("to status"), max_length=20, blank=True)
    notes = models.TextField(_("notes"), blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("match audit log")
        verbose_name_plural = _("match audit logs")
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"AuditLog({self.match_id}, {self.action}, {self.created_at})"
