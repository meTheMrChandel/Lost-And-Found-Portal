"""
posts/models.py — Category, SiteSettings, Post, PostImage, AbuseReport.

19-table schema from the implementation plan.
Key design decisions:
  - Category slugs are the canonical feed filter values
  - Sensitive categories (wallet, cash) are never shown publicly
  - Post auto-expires after POST_EXPIRY_DAYS unless renewed
  - Hidden proof is stored in a dedicated field, never returned in public API
  - Reward is stored as Decimal, honour-based in v1
"""

import uuid
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


# ─── Category ─────────────────────────────────────────────────────────────────

class Category(models.Model):
    """
    Item categories for the feed.

    Seed data: bicycle, phone, laptop, earbuds, keys, id_card, bottle,
               umbrella, wallet, cash, other.
    """

    slug = models.SlugField(_("slug"), primary_key=True, max_length=50)
    name = models.CharField(_("name"), max_length=100)
    is_sensitive = models.BooleanField(
        _("sensitive"),
        default=False,
        help_text=_("Sensitive categories (wallet, cash) are never shown publicly."),
    )
    icon = models.CharField(_("icon"), max_length=50, blank=True)
    order = models.PositiveSmallIntegerField(_("display order"), default=0)

    class Meta:
        verbose_name = _("category")
        verbose_name_plural = _("categories")
        ordering = ["order", "name"]

    def __str__(self) -> str:
        return self.name


# ─── Site Settings ────────────────────────────────────────────────────────────

class SiteSettings(models.Model):
    """
    Singleton model for runtime-configurable settings.
    Only one row should exist (enforced in save()).
    """

    match_threshold = models.FloatField(
        _("match threshold"),
        default=0.75,
        validators=[MinValueValidator(0.0)],
        help_text=_("Pairs scoring above this are added to the admin match queue."),
    )
    post_expiry_days = models.PositiveIntegerField(
        _("post expiry days"),
        default=30,
    )
    otp_expiry_seconds = models.PositiveIntegerField(
        _("OTP expiry (seconds)"),
        default=300,
    )
    otp_max_attempts = models.PositiveSmallIntegerField(
        _("OTP max attempts"),
        default=3,
    )
    admin_review_sla_hours = models.PositiveIntegerField(
        _("admin review SLA (hours)"),
        default=24,
        help_text=_("Remind admin if post not reviewed within this window."),
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("site settings")
        verbose_name_plural = _("site settings")

    def __str__(self) -> str:
        return "Site Settings"

    def save(self, *args, **kwargs):
        self.pk = 1  # force singleton
        super().save(*args, **kwargs)

    @classmethod
    def get(cls) -> "SiteSettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


# ─── Post ─────────────────────────────────────────────────────────────────────

class Post(models.Model):
    """
    Core model — a case is one row here.
    Type: LOST (User 1) or FOUND (User 2).
    """

    class PostType(models.TextChoices):
        LOST = "LOST", _("Lost")
        FOUND = "FOUND", _("Found")

    class Status(models.TextChoices):
        PENDING = "PENDING", _("Pending review")
        APPROVED = "APPROVED", _("Approved / Live")
        REJECTED = "REJECTED", _("Rejected")
        INFO_REQUESTED = "INFO_REQUESTED", _("More info requested")
        EXPIRED = "EXPIRED", _("Expired")
        RETURNED = "RETURNED", _("Returned")
        HIDDEN = "HIDDEN", _("Hidden by admin")

    class CustodyLocation(models.TextChoices):
        WITH_FINDER = "finder", _("With finder")
        ADMIN_OFFICE = "admin_office", _("Admin office")
        SECURITY_OFFICE = "security_office", _("Security office")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="posts",
    )
    post_type = models.CharField(_("type"), max_length=5, choices=PostType.choices)
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="posts",
    )

    # ── Content ───────────────────────────────────────────────────────────────
    title = models.CharField(_("item name"), max_length=200)
    description = models.TextField(_("description"))
    last_seen_place = models.CharField(_("last seen / found place"), max_length=300)
    last_seen_time = models.DateTimeField(_("last seen / found time"))

    # ── Hidden proof (LOST posts only) ────────────────────────────────────────
    hidden_proof = models.TextField(
        _("hidden proof"),
        blank=True,
        help_text=_(
            "Identifying details only the owner would know "
            "(colour, scratches, wallpaper, serial number). Never public."
        ),
    )

    # ── Reward (LOST posts only, honour-based) ────────────────────────────────
    reward_amount = models.DecimalField(
        _("reward amount (₹)"),
        max_digits=8,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal("0"))],
    )

    # ── Found-specific ────────────────────────────────────────────────────────
    custody_location = models.CharField(
        _("custody location"),
        max_length=20,
        choices=CustodyLocation.choices,
        blank=True,
    )
    inform_admin_privately = models.BooleanField(
        _("inform admin privately"),
        default=False,
        help_text=_("Found post visible only to admin, not in public feed."),
    )

    # ── Status / admin ────────────────────────────────────────────────────────
    status = models.CharField(
        _("status"),
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    admin_remarks = models.TextField(_("admin remarks"), blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_posts",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    # ── Lifecycle ─────────────────────────────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    renewed_at = models.DateTimeField(null=True, blank=True)
    expiry_reminder_sent_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text=_("When the owner was reminded to renew; cleared on approval and renewal."),
    )

    class Meta:
        verbose_name = _("post")
        verbose_name_plural = _("posts")
        ordering = ["-created_at"]
        indexes = [
            # Feed index (category + status + created_at)
            models.Index(fields=["category", "status", "-created_at"], name="idx_feed"),
            models.Index(fields=["post_type", "status"], name="idx_type_status"),
            models.Index(fields=["author", "status"], name="idx_author_status"),
            models.Index(fields=["expires_at"], name="idx_expiry"),
        ]

    def __str__(self) -> str:
        return f"[{self.post_type}] {self.title} — {self.status}"

    def save(self, *args, **kwargs):
        if not self.expires_at:
            from django.conf import settings as s
            expiry_days = getattr(s, "POST_EXPIRY_DAYS", 30)
            self.expires_at = timezone.now() + __import__("datetime").timedelta(
                days=expiry_days
            )
        super().save(*args, **kwargs)

    @property
    def is_public(self) -> bool:
        """Return True if this post should appear in the public feed."""
        if self.status != Post.Status.APPROVED:
            return False
        if self.category.is_sensitive:
            return False
        if self.inform_admin_privately:
            return False
        return True


# ─── Post Images ──────────────────────────────────────────────────────────────

class PostImage(models.Model):
    """Photos attached to a post (up to MAX_IMAGES_PER_POST)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(_("image"), upload_to="posts/%Y/%m/")
    thumbnail = models.ImageField(
        _("thumbnail"), upload_to="posts/thumbs/%Y/%m/", blank=True, null=True
    )
    order = models.PositiveSmallIntegerField(_("order"), default=0)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("post image")
        verbose_name_plural = _("post images")
        ordering = ["order", "uploaded_at"]

    def __str__(self) -> str:
        return f"Image for {self.post}"


# ─── Abuse Report ──────────────────────────────────────────────────────────────

class AbuseReport(models.Model):
    """Users can report posts for abuse / inappropriate content."""

    class Reason(models.TextChoices):
        SPAM = "spam", _("Spam")
        FAKE = "fake", _("Fake or misleading")
        INAPPROPRIATE = "inappropriate", _("Inappropriate content")
        OTHER = "other", _("Other")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="abuse_reports")
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="abuse_reports",
    )
    reason = models.CharField(_("reason"), max_length=20, choices=Reason.choices)
    description = models.TextField(_("description"), blank=True)
    is_resolved = models.BooleanField(_("resolved"), default=False)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resolved_reports",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("abuse report")
        verbose_name_plural = _("abuse reports")
        unique_together = [("post", "reporter")]

    def __str__(self) -> str:
        return f"Report on {self.post} by {self.reporter}"
