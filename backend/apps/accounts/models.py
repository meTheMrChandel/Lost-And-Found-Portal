"""
accounts/models.py — Custom User model and OTP model.

Schema decisions:
- AUTH_USER_MODEL = 'accounts.User' (must be set before first migration)
- Email MUST match ^[a-z0-9._%+-]+@iitrpr\\.ac\\.in$ (validated in clean())
- registration_number is unique (e.g. 2024CSM1001)
- email and registration_number are immutable after creation
- Public views expose only full_name and registration_number
"""

import re
import uuid
from datetime import timedelta

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from .managers import UserManager


# ─── Validators ───────────────────────────────────────────────────────────────

IITRPR_EMAIL_RE = re.compile(r"^[a-z0-9._%+\-]+@iitrpr\.ac\.in$")


def validate_iitrpr_email(value: str) -> None:
    """Reject non-IIT Ropar email addresses."""
    if not IITRPR_EMAIL_RE.match(value.lower()):
        raise ValidationError(
            _("Email must be a valid IIT Ropar address (@iitrpr.ac.in)."),
            code="invalid_email_domain",
        )


def validate_registration_number(value: str) -> None:
    """Validate registration number format (e.g. 2024CSM1001)."""
    pattern = re.compile(r"^\d{4}[A-Z]{2,3}\d{4}$")
    if not pattern.match(value.upper()):
        raise ValidationError(
            _("Registration number must follow the format YYYYDDDNNNN (e.g. 2024CSM1001)."),
            code="invalid_registration_number",
        )


# ─── Choices ──────────────────────────────────────────────────────────────────

class Department(models.TextChoices):
    CSE = "CSE", _("Computer Science & Engineering")
    ECE = "ECE", _("Electrical & Communication Engineering")
    ME = "ME", _("Mechanical Engineering")
    CE = "CE", _("Civil Engineering")
    MATHS = "MATHS", _("Mathematics")
    PHYSICS = "PHYSICS", _("Physics")
    CHEMISTRY = "CHEMISTRY", _("Chemistry")
    HSS = "HSS", _("Humanities & Social Sciences")
    OTHER = "OTHER", _("Other")


class ProgramYear(models.TextChoices):
    BTECH_1 = "BTECH_1", _("B.Tech 1st Year")
    BTECH_2 = "BTECH_2", _("B.Tech 2nd Year")
    BTECH_3 = "BTECH_3", _("B.Tech 3rd Year")
    BTECH_4 = "BTECH_4", _("B.Tech 4th Year")
    MTECH_1 = "MTECH_1", _("M.Tech 1st Year")
    MTECH_2 = "MTECH_2", _("M.Tech 2nd Year")
    PHD = "PHD", _("Ph.D")
    FACULTY = "FACULTY", _("Faculty / Staff")


# ─── User ─────────────────────────────────────────────────────────────────────

class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom user model for IIT Ropar Lost & Found Portal.

    Identity fields (immutable after creation):
        email, registration_number

    Profile fields (editable):
        full_name, department, program_year, hostel, phone, photo
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # ── Identity (immutable) ──────────────────────────────────────────────────
    email = models.EmailField(
        _("email address"),
        unique=True,
        validators=[validate_iitrpr_email],
        help_text=_("Must be a valid @iitrpr.ac.in address."),
    )
    registration_number = models.CharField(
        _("registration number"),
        max_length=20,
        unique=True,
        validators=[validate_registration_number],
        help_text=_("e.g. 2024CSM1001"),
    )

    # ── Profile ───────────────────────────────────────────────────────────────
    full_name = models.CharField(_("full name"), max_length=150)
    department = models.CharField(
        _("department"),
        max_length=20,
        choices=Department.choices,
        default=Department.CSE,
    )
    program_year = models.CharField(
        _("program & year"),
        max_length=20,
        choices=ProgramYear.choices,
        default=ProgramYear.MTECH_1,
    )
    hostel = models.CharField(_("hostel"), max_length=100, blank=True)
    phone = models.CharField(_("phone number"), max_length=15, blank=True)
    photo = models.ImageField(
        _("profile photo"),
        upload_to="profiles/",
        blank=True,
        null=True,
    )

    # ── Auth / status ─────────────────────────────────────────────────────────
    is_active = models.BooleanField(_("active"), default=True)
    is_staff = models.BooleanField(_("staff"), default=False)
    is_email_verified = models.BooleanField(_("email verified"), default=False)
    is_banned = models.BooleanField(_("banned"), default=False)
    ban_reason = models.TextField(_("ban reason"), blank=True)

    date_joined = models.DateTimeField(_("date joined"), default=timezone.now)
    last_login = models.DateTimeField(_("last login"), null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["registration_number", "full_name"]

    class Meta:
        verbose_name = _("user")
        verbose_name_plural = _("users")
        ordering = ["-date_joined"]
        indexes = [
            models.Index(fields=["email"]),
            models.Index(fields=["registration_number"]),
        ]

    def __str__(self) -> str:
        return f"{self.full_name} ({self.registration_number})"

    def get_full_name(self) -> str:
        return self.full_name

    def get_short_name(self) -> str:
        return self.full_name.split()[0] if self.full_name else ""

    @property
    def public_display(self) -> dict:
        """Fields exposed in public API responses."""
        return {
            "full_name": self.full_name,
            "registration_number": self.registration_number,
        }

    def clean(self) -> None:
        super().clean()
        # Normalise email to lowercase
        self.email = self.email.lower()
        self.registration_number = self.registration_number.upper()


# ─── OTP ──────────────────────────────────────────────────────────────────────

class OTP(models.Model):
    """
    One-time password for email verification and password reset.

    - 6 digits, stored as a SHA-256 hash
    - 5-minute expiry
    - Max 3 wrong attempts before lockout
    - Resend cooldown: 60 seconds
    """

    class Purpose(models.TextChoices):
        REGISTRATION = "registration", _("Registration")
        PASSWORD_RESET = "password_reset", _("Password Reset")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="otps",
        null=True,
        blank=True,
        help_text=_("Null during initial registration before user is created."),
    )
    email = models.EmailField(_("email"), db_index=True)
    otp_hash = models.CharField(_("OTP hash"), max_length=64)  # SHA-256 hex digest
    purpose = models.CharField(
        _("purpose"), max_length=20, choices=Purpose.choices
    )
    attempts = models.PositiveSmallIntegerField(_("attempts"), default=0)
    is_used = models.BooleanField(_("used"), default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        verbose_name = _("OTP")
        verbose_name_plural = _("OTPs")
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["email", "purpose"]),
            models.Index(fields=["expires_at"]),
        ]

    def __str__(self) -> str:
        return f"OTP({self.email}, {self.purpose}, used={self.is_used})"

    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    def is_locked(self, max_attempts: int = 3) -> bool:
        return self.attempts >= max_attempts


# ─── Device / Token registry ──────────────────────────────────────────────────

class DeviceToken(models.Model):
    """FCM / push notification device tokens (Phase 8)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="device_tokens")
    token = models.TextField(_("FCM token"), unique=True)
    platform = models.CharField(
        _("platform"),
        max_length=10,
        choices=[("android", "Android"), ("ios", "iOS"), ("web", "Web")],
        default="android",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("device token")
        verbose_name_plural = _("device tokens")

    def __str__(self) -> str:
        return f"{self.user} — {self.platform}"
