"""
adminpanel/test_case_assignment.py — Admins can hand a case to another admin (plan, Phase 4).
"""

from datetime import timedelta

import pytest
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.adminpanel.models import PostAuditLog
from apps.notifications.models import Notification
from apps.posts.models import Category, Post


def make_user(email, reg, **extra):
    return User.objects.create_user(email=email, registration_number=reg, password="TestPassword123", full_name=email.split(".")[0], **extra)


@pytest.fixture
def admins(db):
    return make_user("asha.admin@iitrpr.ac.in", "2024ADM1400", is_staff=True), make_user("ravi.admin@iitrpr.ac.in", "2024ADM1401", is_staff=True)


@pytest.fixture
def post(db):
    call_command("seed_data")
    author = make_user("case.student@iitrpr.ac.in", "2024CSM1402")
    return Post.objects.create(
        author=author, post_type=Post.PostType.LOST, category=Category.objects.get(slug="laptop"), title="Grey laptop",
        description="Dell laptop with stickers", last_seen_place="Lab 3", last_seen_time=timezone.now() - timedelta(hours=4),
    )


def client_for(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def assign(by, post, to, **extra):
    return client_for(by).post(f"/api/v1/adminpanel/posts/{post.id}/review/", {"action": "ASSIGN", "assign_to": str(to.id) if to else None, **extra}, format="json")


@pytest.mark.django_db
class TestAssignCase:
    def test_assigning_records_logs_and_notifies_the_assignee(self, admins, post):
        asha, ravi = admins
        res = assign(asha, post, ravi, remarks="Owner is in your hostel")
        assert res.status_code == 200, res.data
        post.refresh_from_db()
        assert post.assigned_to == ravi and post.status == Post.Status.PENDING
        assert res.data["data"]["assigned_to_email"] == ravi.email
        assert PostAuditLog.objects.filter(post=post, action="ASSIGN").exists()
        note = Notification.objects.get(recipient=ravi)
        assert "Grey laptop" in note.body and "Owner is in your hostel" in note.body
        assert not Notification.objects.filter(recipient=post.author).exists()

    def test_assigning_to_yourself_sends_no_notification(self, admins, post):
        asha, _ = admins
        assert assign(asha, post, asha).status_code == 200
        assert not Notification.objects.filter(recipient=asha).exists()

    def test_only_active_admins_can_be_assignees(self, admins, post):
        asha, _ = admins
        student = post.author
        assert assign(asha, post, student).status_code == 400
        assert assign(asha, post, None).status_code == 400
        post.refresh_from_db()
        assert post.assigned_to is None

    def test_queue_filters_by_assignment(self, admins, post):
        asha, ravi = admins
        assign(asha, post, ravi)
        mine = client_for(ravi).get("/api/v1/adminpanel/posts/?assigned_to=me").data["data"]
        assert [p["id"] for p in mine] == [str(post.id)]
        assert client_for(asha).get("/api/v1/adminpanel/posts/?assigned_to=me").data["data"] == []
        assert client_for(asha).get("/api/v1/adminpanel/posts/?assigned_to=none").data["data"] == []

    def test_staff_filter_lists_assignable_admins(self, admins, post):
        asha, ravi = admins
        emails = {u["email"] for u in client_for(asha).get("/api/v1/adminpanel/users/?staff=true").data["data"]}
        assert {asha.email, ravi.email} <= emails and post.author.email not in emails
