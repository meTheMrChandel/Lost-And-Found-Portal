"""
posts/lifecycle.py — Time-based rules of the post lifecycle.

An approved post stays on the feed for SiteSettings.post_expiry_days, counted from
approval (or from the last renewal). run_post_lifecycle(), run hourly by Celery beat
(and by `manage.py run_lifecycle`), then:
  - reminds the owner once when RENEWAL_REMINDER_DAYS or fewer are left
  - moves APPROVED posts past their expiry to EXPIRED, which takes them off the feed
  - alerts admins once about posts PENDING for longer than admin_review_sla_hours
Each run is safe to repeat: a post is only reminded, expired or flagged once.
"""

import math
from datetime import timedelta

from django.utils import timezone

from apps.accounts.models import User
from apps.adminpanel.models import PostAuditLog
from apps.notifications.models import Notification
from apps.notifications.services import create_notification
from apps.posts.models import Post, SiteSettings

RENEWAL_REMINDER_DAYS = 5


def new_expiry_date(now=None):
    """When a post approved or renewed at `now` should expire."""
    now = now or timezone.now()
    return now + timedelta(days=SiteSettings.get().post_expiry_days or 30)


def sla_cutoff(now=None):
    """Posts still PENDING that were submitted before this time have overrun the review SLA."""
    now = now or timezone.now()
    return now - timedelta(hours=SiteSettings.get().admin_review_sla_hours or 24)


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


def alert_overdue_reviews(now=None) -> int:
    """
    Alert every active admin about PENDING posts that overran the review SLA.
    Each post is flagged once; admins get one notification per run listing them.
    Returns how many posts were flagged.
    """
    now = now or timezone.now()
    overdue = Post.objects.filter(
        status=Post.Status.PENDING,
        created_at__lt=sla_cutoff(now),
        sla_alert_sent_at__isnull=True,
    ).order_by("created_at")

    flagged = [
        post
        for post in overdue
        if Post.objects.filter(pk=post.pk, sla_alert_sent_at__isnull=True).update(sla_alert_sent_at=now)
    ]
    if not flagged:
        return 0

    hours = SiteSettings.get().admin_review_sla_hours or 24
    count = len(flagged)
    listed = "\n".join(f"- {post.title}" for post in flagged[:5])
    more = f"\n…and {count - 5} more" if count > 5 else ""
    admins = User.objects.filter(is_staff=True, is_active=True, is_banned=False)
    for admin in admins:
        create_notification(
            recipient=admin,
            notif_type=Notification.NotifType.REVIEW_OVERDUE,
            title=f"{count} report{'s' if count != 1 else ''} waiting over {hours}h for review",
            body=f"These reports are past the {hours}-hour review SLA:\n{listed}{more}",
            data={"post_ids": [str(post.id) for post in flagged]},
        )
    return count


def run_post_lifecycle(now=None) -> dict:
    """Run every periodic lifecycle job once."""
    now = now or timezone.now()
    return {
        "reminders_sent": send_expiry_reminders(now),
        "posts_expired": expire_overdue_posts(now),
        "overdue_reviews_flagged": alert_overdue_reviews(now),
    }
