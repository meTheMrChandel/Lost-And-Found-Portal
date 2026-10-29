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


@pytest.mark.django_db
class TestRenewal:
    def test_renewing_an_expired_post_puts_it_back_on_the_feed(self, client, owner, make_post):
        post = make_post(expires_at=timezone.now() - timedelta(days=1))
        run_post_lifecycle()

        client.force_authenticate(user=owner)
        res = client.post(f"/api/v1/posts/{post.id}/renew/")
        assert res.status_code == 200
        assert res.data["data"]["status"] == "APPROVED"

        post.refresh_from_db()
        assert post.status == Post.Status.APPROVED
        assert days_from_now(post.expires_at) == 30
        log = PostAuditLog.objects.get(post=post, action="RENEW")
        assert (log.previous_status, log.new_status, log.admin) == ("EXPIRED", "APPROVED", owner)

    def test_renewal_rearms_the_reminder(self, client, owner, make_post):
        post = make_post(expires_at=timezone.now() + timedelta(days=2))
        run_post_lifecycle()
        post.refresh_from_db()
        assert post.expiry_reminder_sent_at is not None

        client.force_authenticate(user=owner)
        client.post(f"/api/v1/posts/{post.id}/renew/")
        post.refresh_from_db()
        assert post.expiry_reminder_sent_at is None
        assert post.renewed_at is not None

    @pytest.mark.parametrize(
        "status",
        [Post.Status.PENDING, Post.Status.INFO_REQUESTED, Post.Status.REJECTED, Post.Status.HIDDEN, Post.Status.RETURNED],
    )
    def test_posts_outside_the_feed_lifecycle_cannot_be_renewed(self, client, owner, make_post, status):
        post = make_post(status=status)
        client.force_authenticate(user=owner)
        res = client.post(f"/api/v1/posts/{post.id}/renew/")
        assert res.status_code == 400

        post.refresh_from_db()
        assert post.status == status
        assert post.renewed_at is None
        assert not PostAuditLog.objects.filter(action="RENEW").exists()


@pytest.mark.django_db
class TestReviewSlaWatchdog:
    def test_admins_are_alerted_once_about_overdue_reviews(self, admin_user, owner, make_post):
        second_admin = User.objects.create_user(
            email="lifecycle.admin2@iitrpr.ac.in",
            registration_number="2024ADM1052",
            password="AdminPassword123",
            full_name="Second Admin",
            is_staff=True,
        )
        old = timezone.now() - timedelta(hours=30)
        overdue_a = make_post(status=Post.Status.PENDING, created_at=old)
        overdue_b = make_post(status=Post.Status.PENDING, created_at=old)
        make_post(status=Post.Status.PENDING)  # submitted just now, still within the SLA

        assert run_post_lifecycle()["overdue_reviews_flagged"] == 2
        assert run_post_lifecycle()["overdue_reviews_flagged"] == 0

        for admin in (admin_user, second_admin):
            alerts = admin.notifications.filter(notif_type="review_overdue")
            assert alerts.count() == 1
            assert alerts.first().title == "2 reports waiting over 24h for review"
            assert set(alerts.first().data["post_ids"]) == {str(overdue_a.id), str(overdue_b.id)}
        assert not owner.notifications.filter(notif_type="review_overdue").exists()

    def test_sla_hours_come_from_site_settings(self, client, admin_user, make_post):
        site = SiteSettings.get()
        site.admin_review_sla_hours = 4
        site.save()
        post = make_post(status=Post.Status.PENDING, created_at=timezone.now() - timedelta(hours=5))

        client.force_authenticate(user=admin_user)
        queue = client.get("/api/v1/adminpanel/posts/?sla_breached=true")
        assert [item["id"] for item in queue.data["data"]] == [str(post.id)]
        assert queue.data["data"][0]["is_sla_breached"] is True

        stats = client.get("/api/v1/adminpanel/statistics/")
        assert stats.data["data"]["posts"]["sla_breached"] == 1

        assert run_post_lifecycle()["overdue_reviews_flagged"] == 1
        alert = admin_user.notifications.get(notif_type="review_overdue")
        assert alert.title == "1 report waiting over 4h for review"

    def test_reviewed_posts_are_not_flagged(self, admin_user, make_post):
        make_post(status=Post.Status.APPROVED, created_at=timezone.now() - timedelta(days=3))
        assert run_post_lifecycle()["overdue_reviews_flagged"] == 0
        assert not admin_user.notifications.exists()


@pytest.mark.django_db
class TestResubmissionAfterInfoRequest:
    def test_author_update_sends_the_report_back_for_review(self, client, owner, admin_user, make_post):
        post = make_post(status=Post.Status.PENDING)
        client.force_authenticate(user=admin_user)
        client.post(
            f"/api/v1/adminpanel/posts/{post.id}/review/",
            {"action": "INFO_REQUESTED", "remarks": "What brand is the bottle?"},
        )

        client.force_authenticate(user=owner)
        res = client.patch(
            f"/api/v1/posts/lost/{post.id}/",
            {"description": "Blue Milton Thermosteel bottle with a dent near the cap"},
            format="json",
        )
        assert res.status_code == 200
        assert res.data["data"]["status"] == "PENDING"

        post.refresh_from_db()
        assert post.status == Post.Status.PENDING
        assert "Thermosteel" in post.description
        log = PostAuditLog.objects.get(post=post, action="RESUBMIT")
        assert (log.previous_status, log.new_status, log.admin) == ("INFO_REQUESTED", "PENDING", owner)

        client.force_authenticate(user=admin_user)
        queue = client.get("/api/v1/adminpanel/posts/?status=PENDING")
        assert str(post.id) in [item["id"] for item in queue.data["data"]]

    def test_resubmission_rearms_the_sla_alert(self, client, owner, make_post):
        post = make_post(status=Post.Status.INFO_REQUESTED, sla_alert_sent_at=timezone.now() - timedelta(days=1))
        client.force_authenticate(user=owner)
        client.patch(f"/api/v1/posts/lost/{post.id}/", {"title": "Blue Milton bottle (steel)"}, format="json")

        post.refresh_from_db()
        assert post.sla_alert_sent_at is None

    def test_editing_a_pending_report_does_not_log_a_resubmission(self, client, owner, make_post):
        post = make_post(status=Post.Status.PENDING)
        client.force_authenticate(user=owner)
        client.patch(f"/api/v1/posts/lost/{post.id}/", {"title": "Blue bottle"}, format="json")

        post.refresh_from_db()
        assert post.status == Post.Status.PENDING
        assert not PostAuditLog.objects.filter(action="RESUBMIT").exists()

    def test_admin_edit_keeps_the_info_request_open(self, client, admin_user, make_post):
        post = make_post(status=Post.Status.INFO_REQUESTED)
        client.force_authenticate(user=admin_user)
        client.patch(f"/api/v1/posts/lost/{post.id}/", {"title": "Blue bottle"}, format="json")

        post.refresh_from_db()
        assert post.status == Post.Status.INFO_REQUESTED
