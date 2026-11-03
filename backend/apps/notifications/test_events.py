"""
notifications/test_events.py — Each report and match event notifies the right people, once.
"""

from datetime import timedelta

import pytest
from django.core import mail
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.matching.models import Match
from apps.notifications.models import Notification
from apps.posts.models import Category, Post

NotifType = Notification.NotifType


def make_user(email, reg, **extra):
    return User.objects.create_user(
        email=email, registration_number=reg, password="TestPassword123", full_name=email.split("@")[0], **extra
    )


@pytest.fixture
def owner(db):
    return make_user("events.owner@iitrpr.ac.in", "2024CSM1060")


@pytest.fixture
def finder(db):
    return make_user("events.finder@iitrpr.ac.in", "2024CSM1061")


@pytest.fixture
def admin_user(db):
    return make_user("events.admin@iitrpr.ac.in", "2024ADM1062", is_staff=True)


@pytest.fixture
def as_user():
    def _client(user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    return _client


@pytest.fixture
def make_post(owner):
    call_command("seed_data")
    category = Category.objects.get(slug="bottle")

    def _make(author=owner, post_type=Post.PostType.LOST, status=Post.Status.PENDING, title="Blue Milton bottle"):
        return Post.objects.create(
            author=author,
            post_type=post_type,
            category=category,
            title=title,
            description="Steel bottle with a dent near the cap",
            last_seen_place="Sports complex",
            last_seen_time=timezone.now() - timedelta(days=1),
            status=status,
        )

    return _make


def notifications_for(user, notif_type=None):
    qs = Notification.objects.filter(recipient=user)
    return qs.filter(notif_type=notif_type) if notif_type else qs


@pytest.mark.django_db
class TestNewReports:
    def test_admins_hear_about_a_new_lost_report_in_app_only(self, as_user, owner, admin_user):
        call_command("seed_data")
        res = as_user(owner).post(
            "/api/v1/posts/lost/",
            {
                "title": "Grey hoodie",
                "category": "other",
                "description": "Grey hoodie with a college logo",
                "last_seen_place": "Library",
                "last_seen_time": (timezone.now() - timedelta(hours=2)).isoformat(),
                "hidden_proof": "Name written inside the hood",
            },
            format="multipart",
        )
        assert res.status_code == 201, res.data
        notes = notifications_for(admin_user, NotifType.GENERAL)
        assert notes.count() == 1
        assert "Grey hoodie" in notes.first().body
        assert mail.outbox == []
        # The reporter only gets the in-app receipt
        assert list(notifications_for(owner).values_list("title", flat=True)) == ["We received your report"]


@pytest.mark.django_db
class TestReviewDecisions:
    @pytest.mark.parametrize(
        "action, notif_type, remarks",
        [
            ("APPROVE", NotifType.POST_APPROVED, ""),
            ("REJECT", NotifType.POST_REJECTED, "Photo does not show the item"),
            ("INFO_REQUESTED", NotifType.INFO_REQUESTED, "Which floor exactly?"),
            ("HIDE", NotifType.GENERAL, "Duplicate report"),
        ],
    )
    def test_author_is_told_the_decision_with_the_reason(
        self, as_user, admin_user, owner, make_post, action, notif_type, remarks
    ):
        post = make_post()
        res = as_user(admin_user).post(
            f"/api/v1/adminpanel/posts/{post.id}/review/", {"action": action, "remarks": remarks}, format="json"
        )
        assert res.status_code == 200, res.data
        notes = notifications_for(owner, notif_type)
        assert notes.count() == 1
        if remarks:
            assert remarks in notes.first().body
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == [owner.email]

    def test_category_change_does_not_notify(self, as_user, admin_user, owner, make_post):
        post = make_post()
        as_user(admin_user).post(
            f"/api/v1/adminpanel/posts/{post.id}/review/",
            {"action": "CHANGE_CATEGORY", "new_category": "keys"},
            format="json",
        )
        assert not notifications_for(owner).exists()


@pytest.mark.django_db
class TestMatchLifecycle:
    @pytest.fixture
    def match(self, make_post, owner, finder):
        lost = make_post(author=owner, status=Post.Status.APPROVED, title="Blue Milton bottle")
        found = make_post(author=finder, post_type=Post.PostType.FOUND, status=Post.Status.APPROVED, title="Found steel bottle")
        return Match.objects.create(lost_post=lost, found_post=found, score=0.9)

    def test_confirming_a_match_tells_both_sides(self, as_user, admin_user, owner, finder, match):
        res = as_user(admin_user).post(f"/api/v1/matching/{match.id}/action/", {"action": "CONFIRM"}, format="json")
        assert res.status_code == 200, res.data
        assert notifications_for(owner, NotifType.MATCH_FOUND).count() == 1
        assert notifications_for(finder, NotifType.MATCH_FOUND).count() == 1

    def test_dismissing_a_match_tells_nobody(self, as_user, admin_user, owner, finder, match):
        as_user(admin_user).post(f"/api/v1/matching/{match.id}/action/", {"action": "DISMISS"}, format="json")
        assert not notifications_for(owner).exists()
        assert not notifications_for(finder).exists()

    def test_handover_ready_never_leaks_the_code(self, as_user, admin_user, owner, match):
        res = as_user(admin_user).post(f"/api/v1/matching/{match.id}/handover-code/generate/")
        assert res.status_code == 200, res.data
        code = res.data["code"]
        note = notifications_for(owner, NotifType.HANDOVER_READY).get()
        assert code not in note.body and code not in note.title and code not in str(note.data)
        assert all(code not in m.body and code not in m.subject for m in mail.outbox)

    def test_closing_the_case_tells_both_sides_about_the_reward(self, as_user, admin_user, owner, finder, match):
        res = as_user(admin_user).post(
            f"/api/v1/matching/{match.id}/close/", {"reward_amount_settled": "150.00"}, format="json"
        )
        assert res.status_code == 200, res.data
        assert "₹150" in notifications_for(owner, NotifType.REWARD_RECORDED).get().body
        assert "₹150" in notifications_for(finder, NotifType.REWARD_RECORDED).get().body
