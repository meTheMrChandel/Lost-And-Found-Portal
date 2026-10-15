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
