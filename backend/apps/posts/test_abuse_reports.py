"""
posts/test_abuse_reports.py — Abuse reports alert admins, can't target your own post,
and hide a post automatically once enough different users report it.
"""

from datetime import timedelta

import pytest
from django.core import mail
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.adminpanel.models import PostAuditLog
from apps.notifications.models import Notification
from apps.posts.models import Category, Post, SiteSettings


def make_user(email, reg, **extra):
    return User.objects.create_user(email=email, registration_number=reg, password="TestPassword123", full_name="T", **extra)


@pytest.fixture
def author(db):
    return make_user("abuse.author@iitrpr.ac.in", "2024CSM1100")


@pytest.fixture
def admin_user(db):
    return make_user("abuse.admin@iitrpr.ac.in", "2024ADM1101", is_staff=True)


@pytest.fixture
def reporters(db):
    return [make_user(f"abuse.reporter{i}@iitrpr.ac.in", f"2024CSM11{10 + i}") for i in range(4)]


@pytest.fixture
def post(author):
    call_command("seed_data")
    return Post.objects.create(
        author=author,
        post_type=Post.PostType.FOUND,
        category=Category.objects.get(slug="phone"),
        title="Found a phone",
        description="Black phone near the gym",
        last_seen_place="Gym",
        last_seen_time=timezone.now() - timedelta(hours=1),
        status=Post.Status.APPROVED,
    )


def report(user, post, reason="spam"):
    client = APIClient()
    client.force_authenticate(user)
    return client.post(f"/api/v1/posts/{post.id}/report-abuse/", {"reason": reason}, format="json")


@pytest.mark.django_db
class TestReporting:
    def test_admins_get_an_in_app_alert(self, post, admin_user, reporters):
        assert report(reporters[0], post).status_code == 201
        note = Notification.objects.get(recipient=admin_user)
        assert "Found a phone" in note.body
        assert mail.outbox == []

    def test_authors_cannot_report_their_own_post(self, post, author):
        res = report(author, post)
        assert res.status_code == 400
        assert "own post" in str(res.data)


@pytest.mark.django_db
class TestAutoHide:
    def test_post_stays_live_below_the_threshold(self, post, reporters):
        report(reporters[0], post)
        report(reporters[1], post)
        post.refresh_from_db()
        assert post.status == Post.Status.APPROVED

    def test_third_reporter_hides_the_post_and_tells_everyone(self, post, author, admin_user, reporters):
        for user in reporters[:3]:
            assert report(user, post).status_code == 201
        post.refresh_from_db()
        assert post.status == Post.Status.HIDDEN
        log = PostAuditLog.objects.get(post=post, action="AUTO_HIDE")
        assert log.admin is None and log.previous_status == Post.Status.APPROVED
        assert Notification.objects.filter(recipient=author, title__icontains="hidden").count() == 1
        # The urgent auto-hide alert is also emailed to admins
        assert any(admin_user.email in m.to for m in mail.outbox)
        # A fourth report doesn't hide it again
        report(reporters[3], post)
        assert PostAuditLog.objects.filter(post=post, action="AUTO_HIDE").count() == 1

    def test_threshold_is_configurable_and_zero_turns_it_off(self, post, reporters):
        SiteSettings.objects.update(abuse_auto_hide_threshold=0)
        for user in reporters:
            report(user, post)
        post.refresh_from_db()
        assert post.status == Post.Status.APPROVED

    def test_already_rejected_posts_are_left_alone(self, post, reporters):
        Post.objects.filter(pk=post.pk).update(status=Post.Status.REJECTED)
        for user in reporters[:3]:
            report(user, post)
        post.refresh_from_db()
        assert post.status == Post.Status.REJECTED
