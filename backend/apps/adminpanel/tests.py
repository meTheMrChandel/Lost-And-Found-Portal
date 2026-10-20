import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from apps.adminpanel.models import AdminInvite, PostAuditLog
from apps.posts.models import Category, Post

User = get_user_model()


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def student_user(db):
    return User.objects.create_user(
        email="student.test@iitrpr.ac.in",
        registration_number="2024CSM1030",
        password="TestPassword123",
        full_name="Regular Student",
    )


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email="admin.test@iitrpr.ac.in",
        registration_number="2024ADM1031",
        password="AdminPassword123",
        full_name="Staff Admin",
        is_staff=True,
    )


@pytest.mark.django_db
class TestPhase2RolesAndPermissions:

    def test_student_cannot_access_admin_endpoints(self, client, student_user):
        """Regular student is rejected with 403 on admin-only routes."""
        client.force_authenticate(user=student_user)
        res = client.get("/api/v1/adminpanel/invites/")
        assert res.status_code == 403

        res_users = client.get("/api/v1/adminpanel/users/")
        assert res_users.status_code == 403

    def test_admin_can_generate_invite(self, client, admin_user):
        """Staff member can generate a new admin invite."""
        client.force_authenticate(user=admin_user)
        payload = {"email": "future.admin@iitrpr.ac.in"}
        res = client.post("/api/v1/adminpanel/invites/", payload)
        assert res.status_code == 201
        assert res.data["success"] is True

        invite = AdminInvite.objects.filter(email="future.admin@iitrpr.ac.in").first()
        assert invite is not None
        assert invite.invited_by == admin_user
        assert not invite.is_used

    def test_accept_admin_invite_elevates_user(self, client, admin_user):
        """Accepting an invite elevates account to is_staff."""
        invite = AdminInvite.objects.create(
            email="elevate.me@iitrpr.ac.in",
            invited_by=admin_user,
            expires_at=timezone.now() + timedelta(days=2),
        )

        accept_payload = {
            "token": str(invite.token),
            "password": "NewStaffPassword999",
            "full_name": "Elevated Officer",
        }
        res = client.post("/api/v1/adminpanel/invites/accept/", accept_payload)
        assert res.status_code == 200
        assert res.data["success"] is True

        user = User.objects.get(email="elevate.me@iitrpr.ac.in")
        assert user.is_staff is True
        assert user.check_password("NewStaffPassword999")

        invite.refresh_from_db()
        assert invite.is_used is True

    def test_banned_user_blocked_by_permission(self, client, student_user):
        """Banned user cannot update profile or perform actions."""
        student_user.is_banned = True
        student_user.ban_reason = "Spamming fake items"
        student_user.save()

        client.force_authenticate(user=student_user)
        # Attempt to access profile with IsNotBanned
        from apps.accounts.permissions import IsNotBanned
        permission = IsNotBanned()
        from unittest.mock import Mock
        request = Mock(user=student_user)
        assert permission.has_permission(request, None) is False

    def test_admin_moderation_ban_and_unban(self, client, admin_user, student_user):
        """Staff member can suspend and reinstate accounts."""
        client.force_authenticate(user=admin_user)

        # Ban user
        res = client.post(
            f"/api/v1/adminpanel/users/{student_user.id}/moderate/",
            {"is_banned": True, "ban_reason": "Policy violation"},
        )
        assert res.status_code == 200
        student_user.refresh_from_db()
        assert student_user.is_banned is True

        # Unban user
        res_unban = client.post(
            f"/api/v1/adminpanel/users/{student_user.id}/moderate/",
            {"is_banned": False},
        )
        assert res_unban.status_code == 200
        student_user.refresh_from_db()
        assert student_user.is_banned is False


@pytest.mark.django_db
class TestPhase4AdminPortal:
    """Test suite for Phase 4: Admin Portal (Case Queue, Review, Audit, Stats)."""

    @pytest.fixture(autouse=True)
    def seed_categories(self):
        from django.core.management import call_command
        call_command("seed_data")

    @pytest.fixture
    def test_post(self, student_user):
        category = Category.objects.get(slug="laptop")
        return Post.objects.create(
            author=student_user,
            post_type=Post.PostType.LOST,
            category=category,
            title="Lost ThinkPad T14",
            description="Black ThinkPad laptop left in computer lab",
            last_seen_place="Computer Center Lab 2",
            last_seen_time=timezone.now() - timedelta(hours=2),
            hidden_proof="Small blue Linux sticker on bottom cover near battery latch",
            status=Post.Status.PENDING,
        )

    def test_admin_case_queue_listing_and_filtering(self, client, admin_user, test_post):
        """Staff can list posts in case queue and apply status/category filters."""
        client.force_authenticate(user=admin_user)

        # List all
        res = client.get("/api/v1/adminpanel/posts/")
        assert res.status_code == 200
        items = res.data["data"]
        assert len(items) >= 1
        assert any(item["id"] == str(test_post.id) for item in items)

        # Filter by status PENDING
        res_pending = client.get("/api/v1/adminpanel/posts/?status=PENDING")
        assert res_pending.status_code == 200
        assert any(item["id"] == str(test_post.id) for item in res_pending.data["data"])

        # Filter by status APPROVED (should not include test_post)
        res_approved = client.get("/api/v1/adminpanel/posts/?status=APPROVED")
        assert res_approved.status_code == 200
        assert not any(item["id"] == str(test_post.id) for item in res_approved.data["data"])

        # Search filter
        res_search = client.get("/api/v1/adminpanel/posts/?search=ThinkPad")
        assert res_search.status_code == 200
        assert len(res_search.data["data"]) >= 1

    def test_admin_case_detail_shows_hidden_proof(self, client, admin_user, test_post):
        """Staff can view full details of post including confidential hidden_proof."""
        client.force_authenticate(user=admin_user)
        res = client.get(f"/api/v1/adminpanel/posts/{test_post.id}/")
        assert res.status_code == 200
        data = res.data["data"]
        assert data["title"] == "Lost ThinkPad T14"
        assert data["hidden_proof"] == "Small blue Linux sticker on bottom cover near battery latch"
        assert data["author"]["email"] == "student.test@iitrpr.ac.in"

    def test_admin_can_approve_post_and_logs_audit(self, client, admin_user, test_post):
        """Staff approves a post, publishing it to feed and recording audit trail."""
        client.force_authenticate(user=admin_user)

        payload = {"action": "APPROVE", "remarks": "Item verified with security log."}
        res = client.post(f"/api/v1/adminpanel/posts/{test_post.id}/review/", payload)
        assert res.status_code == 200
        assert res.data["data"]["status"] == "APPROVED"

        test_post.refresh_from_db()
        assert test_post.status == Post.Status.APPROVED
        assert test_post.reviewed_by == admin_user
        assert test_post.reviewed_at is not None

        # Verify audit log exists
        audit = PostAuditLog.objects.filter(post=test_post, action="APPROVE").first()
        assert audit is not None
        assert audit.admin == admin_user
        assert audit.previous_status == "PENDING"
        assert audit.new_status == "APPROVED"

    def test_admin_can_reject_post_with_reason(self, client, admin_user, test_post):
        """Staff rejects a post with required reason, notifying student via remarks."""
        client.force_authenticate(user=admin_user)

        # Remarks required for REJECT
        res_fail = client.post(f"/api/v1/adminpanel/posts/{test_post.id}/review/", {"action": "REJECT"})
        assert res_fail.status_code == 400

        # Successful reject
        payload = {"action": "REJECT", "remarks": "Duplicate entry. Item already reported by friend."}
        res = client.post(f"/api/v1/adminpanel/posts/{test_post.id}/review/", payload)
        assert res.status_code == 200
        assert res.data["data"]["status"] == "REJECTED"

        test_post.refresh_from_db()
        assert test_post.status == Post.Status.REJECTED
        assert test_post.admin_remarks == "Duplicate entry. Item already reported by friend."

        # Audit log verified
        assert PostAuditLog.objects.filter(post=test_post, action="REJECT").exists()

    def test_admin_can_request_info(self, client, admin_user, test_post):
        """Staff can request more info from author."""
        client.force_authenticate(user=admin_user)

        payload = {"action": "INFO_REQUESTED", "remarks": "Please provide serial number or exact colour."}
        res = client.post(f"/api/v1/adminpanel/posts/{test_post.id}/review/", payload)
        assert res.status_code == 200
        assert res.data["data"]["status"] == "INFO_REQUESTED"

        test_post.refresh_from_db()
        assert test_post.status == Post.Status.INFO_REQUESTED
        assert test_post.admin_remarks == "Please provide serial number or exact colour."

    def test_admin_can_change_category(self, client, admin_user, test_post):
        """Staff can reassign category of a misclassified post."""
        client.force_authenticate(user=admin_user)

        payload = {"action": "CHANGE_CATEGORY", "new_category": "other", "remarks": "Misclassified as laptop"}
        res = client.post(f"/api/v1/adminpanel/posts/{test_post.id}/review/", payload)
        assert res.status_code == 200

        test_post.refresh_from_db()
        assert test_post.category.slug == "other"
        assert PostAuditLog.objects.filter(post=test_post, action="CHANGE_CATEGORY").exists()

    def test_student_cannot_review_posts(self, client, student_user, test_post):
        """Regular student receives 403 on case queue and review endpoints."""
        client.force_authenticate(user=student_user)

        res_queue = client.get("/api/v1/adminpanel/posts/")
        assert res_queue.status_code == 403

        res_review = client.post(f"/api/v1/adminpanel/posts/{test_post.id}/review/", {"action": "APPROVE"})
        assert res_review.status_code == 403

    def test_admin_statistics_endpoint(self, client, admin_user, test_post):
        """Staff can retrieve platform metrics and counts."""
        client.force_authenticate(user=admin_user)
        res = client.get("/api/v1/adminpanel/statistics/")
        assert res.status_code == 200
        data = res.data["data"]
        assert "users" in data
        assert "posts" in data
        assert data["posts"]["total"] >= 1
        assert "category_breakdown" in data

    def test_admin_abuse_reports_list_and_resolve(self, client, admin_user, student_user, test_post):
        """Staff can list user abuse reports and resolve them."""
        from apps.posts.models import AbuseReport
        report = AbuseReport.objects.create(
            post=test_post,
            reporter=student_user,
            reason="spam",
            description="Looks like a test post",
        )

        client.force_authenticate(user=admin_user)

        # List reports
        res_list = client.get("/api/v1/adminpanel/abuse-reports/")
        assert res_list.status_code == 200
        assert len(res_list.data["data"]) >= 1

        # Resolve report
        res_resolve = client.post(f"/api/v1/adminpanel/abuse-reports/{report.id}/resolve/")
        assert res_resolve.status_code == 200
        assert res_resolve.data["data"]["is_resolved"] is True

        report.refresh_from_db()
        assert report.is_resolved is True
        assert report.resolved_by == admin_user

