"""
adminpanel/test_audit_log.py — The post audit log is append-only and outlives the posts it describes.
"""

from datetime import timedelta

import pytest
from django.contrib import admin
from django.core.management import call_command
from django.test import RequestFactory
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.adminpanel.models import ImmutableAuditLogError, PostAuditLog
from apps.posts.models import Category, Post


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def student_user(db):
    return User.objects.create_user(
        email="audit.student@iitrpr.ac.in",
        registration_number="2024CSM1040",
        password="TestPassword123",
        full_name="Audit Student",
    )


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email="audit.admin@iitrpr.ac.in",
        registration_number="2024ADM1041",
        password="AdminPassword123",
        full_name="Audit Admin",
        is_staff=True,
    )


@pytest.fixture
def lost_post(student_user):
    call_command("seed_data")
    return Post.objects.create(
        author=student_user,
        post_type=Post.PostType.LOST,
        category=Category.objects.get(slug="laptop"),
        title="Lost HP Pavilion",
        description="Silver HP laptop in a black sleeve",
        last_seen_place="Lecture Hall Complex",
        last_seen_time=timezone.now() - timedelta(hours=3),
        status=Post.Status.PENDING,
    )


@pytest.mark.django_db
class TestAuditLogOutlivesPost:
    def test_admin_delete_keeps_the_posts_history(self, client, admin_user, lost_post):
        client.force_authenticate(user=admin_user)
        post_id = lost_post.id
        client.post(f"/api/v1/adminpanel/posts/{post_id}/review/", {"action": "APPROVE"})
        res = client.post(
            f"/api/v1/adminpanel/posts/{post_id}/review/", {"action": "DELETE", "remarks": "Duplicate report"}
        )
        assert res.status_code == 200
        assert not Post.objects.filter(pk=post_id).exists()

        logs = PostAuditLog.objects.filter(post_ref=post_id).order_by("created_at")
        assert [log.action for log in logs] == ["APPROVE", "DELETE"]
        assert all(log.post is None and log.post_title == "Lost HP Pavilion" for log in logs)

        # The audit endpoint's post filter still finds them
        res_logs = client.get(f"/api/v1/adminpanel/audit-logs/?post_id={post_id}")
        assert res_logs.status_code == 200
        assert {entry["action"] for entry in res_logs.data["data"]} == {"APPROVE", "DELETE"}
        assert all(entry["post_title"] == "Lost HP Pavilion" for entry in res_logs.data["data"])

    def test_author_withdrawal_is_logged(self, client, student_user, lost_post):
        client.force_authenticate(user=student_user)
        res = client.delete(f"/api/v1/posts/lost/{lost_post.id}/")
        assert res.status_code == 200

        log = PostAuditLog.objects.get(post_ref=lost_post.id)
        assert log.action == "WITHDRAW"
        assert log.admin == student_user
        assert (log.previous_status, log.new_status) == ("PENDING", "DELETED")


@pytest.mark.django_db
class TestAuditLogIsAppendOnly:
    @pytest.fixture
    def entry(self, admin_user, lost_post):
        return PostAuditLog.objects.create(
            post=lost_post,
            admin=admin_user,
            action="APPROVE",
            previous_status="PENDING",
            new_status="APPROVED",
        )

    def test_entry_records_post_snapshot(self, entry, lost_post):
        assert entry.post_ref == lost_post.id
        assert entry.post_title == lost_post.title

    def test_entry_cannot_be_edited(self, entry):
        entry.notes = "rewritten"
        with pytest.raises(ImmutableAuditLogError):
            entry.save()
        with pytest.raises(ImmutableAuditLogError):
            PostAuditLog.objects.filter(pk=entry.pk).update(notes="rewritten")
        entry.refresh_from_db()
        assert entry.notes == ""

    def test_entry_cannot_be_deleted(self, entry):
        with pytest.raises(ImmutableAuditLogError):
            entry.delete()
        with pytest.raises(ImmutableAuditLogError):
            PostAuditLog.objects.all().delete()
        assert PostAuditLog.objects.filter(pk=entry.pk).exists()

    def test_django_admin_is_read_only(self, admin_user):
        model_admin = admin.site._registry[PostAuditLog]
        request = RequestFactory().get("/admin/")
        request.user = admin_user
        assert not model_admin.has_add_permission(request)
        assert not model_admin.has_change_permission(request)
        assert not model_admin.has_delete_permission(request)

    def test_deleting_the_admin_user_keeps_the_entry(self, entry, admin_user):
        admin_user.delete()
        entry.refresh_from_db()
        assert entry.admin is None
        assert entry.action == "APPROVE"
