"""
notifications/services.py — Centralized notification dispatcher.
Supports in-app database records, email dispatch, and realtime delivery.
"""

import logging
from typing import Optional, Dict, Any
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from apps.accounts.models import User
from apps.notifications.models import Notification

logger = logging.getLogger(__name__)


def create_notification(
    recipient: User,
    notif_type: str,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
    send_email_copy: bool = True,
) -> Notification:
    """
    Creates an in-app Notification record and optionally dispatches an email notification.
    """
    notif = Notification.objects.create(
        recipient=recipient,
        notif_type=notif_type,
        title=title,
        body=body,
        data=data or {},
    )

    # Optional email dispatch
    if send_email_copy and recipient.email:
        try:
            subject = f"[IIT Ropar Lost & Found] {title}"
            from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "lostandfound@iitrpr.ac.in")
            send_mail(
                subject=subject,
                message=body,
                from_email=from_email,
                recipient_list=[recipient.email],
                fail_silently=True,
            )
        except Exception as e:
            logger.warning(f"Failed to dispatch notification email to {recipient.email}: {e}")

    return notif
