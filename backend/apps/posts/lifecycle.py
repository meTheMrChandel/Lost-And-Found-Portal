"""
posts/lifecycle.py — Time-based rules of the post lifecycle.

An approved post stays on the feed for SiteSettings.post_expiry_days, counted from
approval (or from the last renewal).
"""

from datetime import timedelta

from django.utils import timezone

from apps.posts.models import SiteSettings


def new_expiry_date(now=None):
    """When a post approved or renewed at `now` should expire."""
    now = now or timezone.now()
    return now + timedelta(days=SiteSettings.get().post_expiry_days or 30)
