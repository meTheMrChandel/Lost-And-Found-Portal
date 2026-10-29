"""
posts/test_lifecycle.py — Post lifecycle rules: expiry timer, auto-expiry, renewal reminders,
renewals, re-submission after an info request, and the admin review SLA.
"""

from datetime import timedelta

import pytest
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.adminpanel.models import PostAuditLog
from apps.posts.lifecycle import run_post_lifecycle
from apps.posts.models import Category, Post, SiteSettings


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def owner(db):
    return User.objects.create_user(
        email="lifecycle.owner@iitrpr.ac.in",
        registration_number="2024CSM1050",
        password="TestPassword123",
        full_name="Lifecycle Owner",
    )


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email="lifecycle.admin@iitrpr.ac.in",
        registration_number="2024ADM1051",
        password="AdminPassword123",
        full_name="Lifecycle Admin",
        is_staff=True,
    )


@pytest.fixture
def make_post(owner):
    call_command("seed_data")
    category = Category.objects.get(slug="bottle")

    def _make(status=Post.Status.APPROVED, **fields):
        post = Post.objects.create(
            author=owner,
            post_type=Post.PostType.LOST,
            category=category,
            title="Blue Milton bottle",
            description="Steel bottle with a dent near the cap",
            last_seen_place="Sports complex",
            last_seen_time=timezone.now() - timedelta(days=1),
            status=status,
        )
        # created_at is auto_now_add, so backdate it with an update
        if fields:
            Post.objects.filter(pk=post.pk).update(**fields)
            post.refresh_from_db()
        return post

    return _make


def days_from_now(when):
    return round((when - timezone.now()).total_seconds() / 86400)


@pytest.mark.django_db
class TestExpiryTimerStartsAtApproval:
    def test_approval_restarts_the_timer(self, client, admin_user, make_post):
        # Submitted 10 days ago, so the timer set at creation has only ~20 days left
        post = make_post(
            status=Post.Status.PENDING,
            created_at=timezone.now() - timedelta(days=10),
            expires_at=timezone.now() + timedelta(days=20),
        )
        client.force_authenticate(user=admin_user)
        res = client.post(f"/api/v1/adminpanel/posts/{post.id}/review/", {"action": "APPROVE"})
        assert res.status_code == 200

        post.refresh_from_db()
        assert days_from_now(post.expires_at) == 30

    def test_approval_uses_the_configured_expiry_days(self, client, admin_user, make_post):
        site = SiteSettings.get()
        site.post_expiry_days = 14
        site.save()

        post = make_post(status=Post.Status.PENDING)
        client.force_authenticate(user=admin_user)
        client.post(f"/api/v1/adminpanel/posts/{post.id}/review/", {"action": "APPROVE"})

        post.refresh_from_db()
        assert days_from_now(post.expires_at) == 14


@pytest.mark.django_db
class TestAutoExpiry:
    def test_overdue_post_expires_and_leaves_the_feed(self, client, owner, make_post):
        post = make_post(expires_at=timezone.now() - timedelta(minutes=5))

        call_command("run_lifecycle")

        post.refresh_from_db()
        assert post.status == Post.Status.EXPIRED
        feed = client.get("/api/v1/posts/feed/?include_pending=false")
        assert all(item["id"] != str(post.id) for item in feed.data["data"])

        log = PostAuditLog.objects.get(post=post)
        assert (log.action, log.previous_status, log.new_status) == ("EXPIRE", "APPROVED", "EXPIRED")
        assert log.admin is None
        assert owner.notifications.filter(notif_type="post_expired", data__post_id=str(post.id)).exists()

    def test_only_overdue_approved_posts_expire(self, make_post):
        still_live = make_post(expires_at=timezone.now() + timedelta(days=3))
        pending = make_post(status=Post.Status.PENDING, expires_at=timezone.now() - timedelta(days=1))

        result = run_post_lifecycle()

        assert result["posts_expired"] == 0
        still_live.refresh_from_db()
        pending.refresh_from_db()
        assert still_live.status == Post.Status.APPROVED
        assert pending.status == Post.Status.PENDING

    def test_running_twice_expires_once(self, owner, make_post):
        make_post(expires_at=timezone.now() - timedelta(hours=1))

        assert run_post_lifecycle()["posts_expired"] == 1
        assert run_post_lifecycle()["posts_expired"] == 0
        assert PostAuditLog.objects.filter(action="EXPIRE").count() == 1
        assert owner.notifications.filter(notif_type="post_expired").count() == 1


@pytest.mark.django_db
class TestRenewalReminder:
    def test_owner_is_reminded_once_when_five_days_are_left(self, owner, make_post):
        post = make_post(expires_at=timezone.now() + timedelta(days=4, hours=12))

        assert run_post_lifecycle()["reminders_sent"] == 1
        assert run_post_lifecycle()["reminders_sent"] == 0

        reminders = owner.notifications.filter(notif_type="post_expiring")
        assert reminders.count() == 1
        assert "5 days" in reminders.first().title
        post.refresh_from_db()
        assert post.expiry_reminder_sent_at is not None

    def test_no_reminder_while_more_than_five_days_are_left(self, owner, make_post):
        make_post(expires_at=timezone.now() + timedelta(days=6))
        assert run_post_lifecycle()["reminders_sent"] == 0
        assert not owner.notifications.exists()

    def test_approval_clears_an_earlier_reminder(self, client, admin_user, make_post):
        post = make_post(status=Post.Status.HIDDEN, expiry_reminder_sent_at=timezone.now() - timedelta(days=2))
        client.force_authenticate(user=admin_user)
        client.post(f"/api/v1/adminpanel/posts/{post.id}/review/", {"action": "APPROVE"})

        post.refresh_from_db()
        assert post.expiry_reminder_sent_at is None
