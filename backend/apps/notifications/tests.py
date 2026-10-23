"""
notifications/tests.py — Automated tests for in-app notifications and unread tracking.
"""

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.notifications.models import Notification
from apps.notifications.services import create_notification


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def student_user(db):
    user = User.objects.create_user(
        email="student_notif@iitrpr.ac.in",
        password="ValidPassword@123",
        full_name="Student Receiver",
        registration_number="2024CSM1080",
    )
    user.is_email_verified = True
    user.save()
    return user


@pytest.mark.django_db
class TestNotificationsSystem:
    """Tests for in-app notification creation, unread count badge, and mark-read actions."""

    def test_notification_creation_and_listing(self, api_client, student_user):
        """User receives notifications and can list them via API."""
        create_notification(
            recipient=student_user,
            notif_type=Notification.NotifType.POST_APPROVED,
            title="Lost Report Approved",
            body="Your lost report for 'Dell Laptop' has been verified and published to the feed.",
            data={"post_id": "fake-post-id"},
            send_email_copy=False,
        )

        api_client.force_authenticate(user=student_user)
        res = api_client.get("/api/v1/notifications/")
        assert res.status_code == status.HTTP_200_OK

        results = res.data.get("results", res.data)
        assert len(results) == 1
        assert results[0]["title"] == "Lost Report Approved"
        assert results[0]["is_read"] is False

    def test_unread_count_badge_endpoint(self, api_client, student_user):
        """Unread count calculates accurately and decrements when marked as read."""
        create_notification(recipient=student_user, notif_type="test1", title="N1", body="B1", send_email_copy=False)
        create_notification(recipient=student_user, notif_type="test2", title="N2", body="B2", send_email_copy=False)

        api_client.force_authenticate(user=student_user)

        # Initially 2 unread
        res_count = api_client.get("/api/v1/notifications/unread-count/")
        assert res_count.status_code == status.HTTP_200_OK
        assert res_count.data["unread_count"] == 2

        # Mark all as read
        res_read = api_client.post("/api/v1/notifications/mark-all-read/")
        assert res_read.status_code == status.HTTP_200_OK
        assert res_read.data["updated_count"] == 2

        # Count is now 0
        res_count_after = api_client.get("/api/v1/notifications/unread-count/")
        assert res_count_after.data["unread_count"] == 0
