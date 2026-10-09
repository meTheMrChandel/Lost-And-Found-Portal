"""
accounts/utils.py — OTP generation, hashing, email delivery, and verification.
"""

import hashlib
import random
import string
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from .models import OTP


def generate_otp_code() -> str:
    """Return a 6-digit numeric OTP code."""
    return "".join(random.choices(string.digits, k=6))


def hash_otp(code: str) -> str:
    """SHA-256 hex digest of the raw OTP code (never stored in plain text)."""
    return hashlib.sha256(code.encode()).hexdigest()


def create_otp(email: str, purpose: str, user=None) -> str:
    """
    Invalidate any existing active OTPs for this email+purpose,
    create a new hashed OTP, persist it, and return the raw code.
    """
    OTP.objects.filter(
        email=email.lower(),
        purpose=purpose,
        is_used=False,
    ).update(is_used=True)

    expiry_seconds = getattr(settings, "OTP_EXPIRY_SECONDS", 300)
    code = generate_otp_code()

    OTP.objects.create(
        user=user,
        email=email.lower(),
        otp_hash=hash_otp(code),
        purpose=purpose,
        expires_at=timezone.now() + timedelta(seconds=expiry_seconds),
    )
    return code


def send_otp_email(email: str, code: str, purpose: str) -> None:
    """Send OTP via email using configured email backend."""
    subject_map = {
        OTP.Purpose.REGISTRATION: "IIT Ropar Lost & Found — Email Verification OTP",
        OTP.Purpose.PASSWORD_RESET: "IIT Ropar Lost & Found — Password Reset OTP",
    }
    subject = subject_map.get(purpose, "Your OTP Code")
    expiry_min = getattr(settings, "OTP_EXPIRY_SECONDS", 300) // 60
    message = (
        f"Hello,\n\n"
        f"Your verification code for IIT Ropar Lost & Found Portal is: {code}\n\n"
        f"This code will expire in {expiry_min} minutes.\n"
        f"For security reasons, do not share this OTP with anyone.\n\n"
        f"If you did not request this OTP, please ignore this email.\n\n"
        f"Best regards,\nIIT Ropar Lost & Found Team"
    )
    send_mail(
        subject=subject,
        message=message,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@iitrpr.ac.in"),
        recipient_list=[email],
        fail_silently=False,
    )
