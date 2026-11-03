"""
adminpanel/test_beta_metrics.py — The statistics the beta is judged on (plan, Phase 11):
posts and registrations per day, average time to return, and admin response time.
"""

from datetime import timedelta
from unittest import mock

import pytest
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.adminpanel.models import PostAuditLog
from apps.matching.models import Match
from apps.posts.models import Category, Post, SiteSettings


@pytest.fixture
def admin_client(db):
    admin = User.objects.create_user(
        email="metrics.admin@iitrpr.ac.in",
        registration_number="2024ADM1080",
        password="AdminPassword123",
        full_name="Metrics Admin",
        is_staff=True,
    )
    client = APIClient()
    client.force_authenticate(admin)
    client.admin = admin
    return client


@pytest.fixture
def make_post(db):
    call_command("seed_data")
    author = User.objects.create_user(
        email="metrics.student@iitrpr.ac.in",
        registration_number="2024CSM1081",
        password="TestPassword123",
        full_name="Metrics Student",
    )
    category = Category.objects.get(slug="phone")

    def _make(post_type=Post.PostType.LOST, created_at=None, status=Post.Status.PENDING):
        post = Post.objects.create(
            author=author,
            post_type=post_type,
            category=category,
            title="Black phone",
            description="Black phone with a cracked corner",
            last_seen_place="Hostel mess",
            last_seen_time=timezone.now() - timedelta(days=5),
            status=status,
        )
        if created_at:
            Post.objects.filter(pk=post.pk).update(created_at=created_at)
            post.refresh_from_db()
        return post

    return _make


def stats(client):
    res = client.get("/api/v1/adminpanel/statistics/")
    assert res.status_code == 200, res.data
    return res.data["data"]


@pytest.mark.django_db
class TestDailyTrend:
    def test_counts_reports_and_registrations_per_day(self, admin_client, make_post):
        now = timezone.now()
        make_post(created_at=now)
        make_post(created_at=now)
        make_post(post_type=Post.PostType.FOUND, created_at=now - timedelta(days=1))
        make_post(created_at=now - timedelta(days=30))  # outside the window

        daily = stats(admin_client)["trends"]["daily"]
        assert len(daily) == 14
        today = timezone.localdate().isoformat()
        yesterday = (timezone.localdate() - timedelta(days=1)).isoformat()
        assert daily[-1]["date"] == today
        by_date = {d["date"]: d for d in daily}
        assert (by_date[today]["lost"], by_date[today]["found"]) == (2, 0)
        assert (by_date[yesterday]["lost"], by_date[yesterday]["found"]) == (0, 1)
        assert sum(d["lost"] + d["found"] for d in daily) == 3
        # The admin and the student both registered today
        assert by_date[today]["registrations"] == 2


@pytest.mark.django_db
class TestSpeedMetrics:
    def test_nothing_to_measure_is_null_not_zero(self, admin_client):
        trends = stats(admin_client)["trends"]
        assert trends["avg_hours_to_return"] is None and trends["returns_measured"] == 0
        assert trends["avg_hours_to_first_review"] is None and trends["reviews_measured"] == 0

    def test_average_time_to_return(self, admin_client, make_post):
        now = timezone.now()
        for hours in (10, 30):
            lost = make_post(created_at=now - timedelta(hours=hours), status=Post.Status.RETURNED)
            found = make_post(post_type=Post.PostType.FOUND, status=Post.Status.RETURNED)
            Match.objects.create(lost_post=lost, found_post=found, status=Match.Status.CLOSED, reward_settled_at=now)
        # An open match is not a return yet
        Match.objects.create(lost_post=make_post(), found_post=make_post(post_type=Post.PostType.FOUND))

        trends = stats(admin_client)["trends"]
        assert trends["returns_measured"] == 2
        assert trends["avg_hours_to_return"] == 20.0

    def test_admin_response_time_uses_the_first_decision_only(self, admin_client, make_post):
        now = timezone.now()
        post = make_post(created_at=now - timedelta(hours=6))
        # The audit log is append-only, so write each entry at a chosen time instead of editing it
        with mock.patch("django.utils.timezone.now", return_value=now - timedelta(hours=2)):
            PostAuditLog.objects.create(post=post, admin=admin_client.admin, action="INFO_REQUESTED")
        PostAuditLog.objects.create(post=post, admin=admin_client.admin, action="APPROVE")
        # An author's own resubmission is not an admin response
        other = make_post(created_at=now - timedelta(hours=1))
        PostAuditLog.objects.create(post=other, admin=admin_client.admin, action="RESUBMIT")

        trends = stats(admin_client)["trends"]
        assert trends["reviews_measured"] == 1
        assert trends["avg_hours_to_first_review"] == 4.0


@pytest.mark.django_db
class TestReviewSlaHours:
    def test_settings_expose_and_update_the_sla(self, admin_client):
        assert admin_client.get("/api/v1/adminpanel/settings/").data["data"]["admin_review_sla_hours"] == 24
        res = admin_client.patch("/api/v1/adminpanel/settings/", {"admin_review_sla_hours": 12}, format="json")
        assert res.status_code == 200, res.data
        assert SiteSettings.get().admin_review_sla_hours == 12
        assert stats(admin_client)["review_sla_hours"] == 12

    def test_zero_hours_is_rejected(self, admin_client):
        res = admin_client.patch("/api/v1/adminpanel/settings/", {"admin_review_sla_hours": 0}, format="json")
        assert res.status_code == 400
