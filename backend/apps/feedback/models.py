"""
feedback/models.py — What beta testers tell us about the portal (plan, Phase 11 rollout).
"""

import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _


class Feedback(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="feedback",
    )
    rating = models.PositiveSmallIntegerField(
        _("rating"), validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    message = models.TextField(_("message"), max_length=2000)
    # Where it was sent from, e.g. "/feed" or "mobile:Feed"
    page = models.CharField(_("page"), max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("feedback")
        verbose_name_plural = _("feedback")
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.rating}/5 from {self.user} ({self.created_at:%d %b})"
