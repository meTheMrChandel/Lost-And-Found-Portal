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


import logging

logger = logging.getLogger(__name__)


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

    print(f"\n==========================================")
    print(f" [OTP DISPATCH] Email: {email} | Purpose: {purpose}")
    print(f" >>> VERIFICATION CODE: {code} <<<")
    print(f"==========================================\n")
    logger.info("Generated OTP %s for %s (%s)", code, email, purpose)

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@iitrpr.ac.in"),
            recipient_list=[email],
            fail_silently=False,
        )
    except Exception as exc:
        logger.warning("SMTP email delivery to %s failed: %s", email, exc)
        print(f"⚠️ SMTP delivery notice ({exc}). Use the printed code above: {code}")


def verify_otp(email: str, code: str, purpose: str) -> tuple[bool, str]:
    """
    Verify submitted OTP code against stored SHA-256 hash.
    Enforces expiry and a max 3 attempt lockout.
    Returns (success: bool, error_message: str).
    """
    max_attempts = getattr(settings, "OTP_MAX_ATTEMPTS", 3)

    try:
        otp = OTP.objects.filter(
            email=email.lower(),
            purpose=purpose,
            is_used=False,
        ).latest("created_at")
    except OTP.DoesNotExist:
        return False, "No active OTP found. Please request a new one."

    if otp.is_expired():
        return False, "OTP has expired. Please request a new one."

    if otp.is_locked(max_attempts):
        return False, "Too many wrong attempts. This OTP is locked. Please request a new one."

    if otp.otp_hash != hash_otp(code):
        otp.attempts += 1
        otp.save(update_fields=["attempts"])
        remaining = max_attempts - otp.attempts
        if remaining <= 0:
            return False, "Too many wrong attempts. This OTP is locked. Please request a new one."
        return False, f"Incorrect OTP. {remaining} attempt(s) remaining."

    # Mark OTP as successfully used
    otp.is_used = True
    otp.save(update_fields=["is_used"])
    return True, ""

