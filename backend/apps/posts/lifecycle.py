"""
posts/lifecycle.py — Time-based rules of the post lifecycle.

An approved post stays on the feed for SiteSettings.post_expiry_days, counted from
approval (or from the last renewal). run_post_lifecycle(), run hourly by Celery beat
(and by `manage.py run_lifecycle`), then:
  - reminds the owner once when RENEWAL_REMINDER_DAYS or fewer are left
  - moves APPROVED posts past their expiry to EXPIRED, which takes them off the feed
Each run is safe to repeat: a post is only reminded or expired once.
"""

import math
from datetime import timedelta

from django.utils import timezone

from apps.adminpanel.models import PostAuditLog
from apps.notifications.models import Notification
from apps.notifications.services import create_notification
from apps.posts.models import Post, SiteSettings

RENEWAL_REMINDER_DAYS = 5


def new_expiry_date(now=None):
    """When a post approved or renewed at `now` should expire."""
    now = now or timezone.now()
    return now + timedelta(days=SiteSettings.get().post_expiry_days or 30)


def send_expiry_reminders(now=None) -> int:
    """Remind owners whose approved post expires within RENEWAL_REMINDER_DAYS. Returns how many."""
    now = now or timezone.now()
    due = Post.objects.filter(
        status=Post.Status.APPROVED,
        expires_at__gt=now,
        expires_at__lte=now + timedelta(days=RENEWAL_REMINDER_DAYS),
        expiry_reminder_sent_at__isnull=True,
    ).select_related("author")

    sent = 0
    for post in due:
        # Claim the post first so overlapping runs cannot remind twice
        claimed = Post.objects.filter(pk=post.pk, expiry_reminder_sent_at__isnull=True).update(
            expiry_reminder_sent_at=now
        )
        if not claimed or post.author is None:
            continue

        days_left = math.ceil((post.expires_at - now).total_seconds() / 86400)
        create_notification(
            recipient=post.author,
            notif_type=Notification.NotifType.POST_EXPIRING,
            title=f'"{post.title}" leaves the feed in {days_left} day{"s" if days_left != 1 else ""}',
            body="Renew it with one click to keep it on the campus feed for another "
            f"{SiteSettings.get().post_expiry_days or 30} days.",
            data={"post_id": str(post.id), "expires_at": post.expires_at.isoformat()},
        )
        sent += 1
    return sent


def expire_overdue_posts(now=None) -> int:
    """Move APPROVED posts whose expiry has passed to EXPIRED. Returns how many."""
    now = now or timezone.now()
    overdue = Post.objects.filter(status=Post.Status.APPROVED, expires_at__lte=now).select_related("author")

    expired = 0
    for post in overdue:
        # Conditional update, so a post renewed or changed since the query is left alone
        claimed = Post.objects.filter(pk=post.pk, status=Post.Status.APPROVED, expires_at__lte=now).update(
            status=Post.Status.EXPIRED, updated_at=now
        )
        if not claimed:
            continue

        PostAuditLog.objects.create(
            post=post,
            admin=None,
            action="EXPIRE",
            previous_status=Post.Status.APPROVED,
            new_status=Post.Status.EXPIRED,
            notes=f"Expired automatically: not renewed before {timezone.localtime(post.expires_at):%d %b %Y %H:%M}.",
        )
        if post.author is not None:
            create_notification(
                recipient=post.author,
                notif_type=Notification.NotifType.POST_EXPIRED,
                title=f'"{post.title}" has expired',
                body="It is no longer shown on the campus feed. Renew it to publish it again.",
                data={"post_id": str(post.id)},
            )
        expired += 1
    return expired


def run_post_lifecycle(now=None) -> dict:
    """Run every periodic lifecycle job once."""
    now = now or timezone.now()
    return {
        "reminders_sent": send_expiry_reminders(now),
        "posts_expired": expire_overdue_posts(now),
    }
