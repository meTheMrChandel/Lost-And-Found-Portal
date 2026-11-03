"""
feedback/tests.py — Beta feedback API, plus the health and app-config endpoints that
uptime monitors and the mobile app depend on.
"""

from unittest import mock

import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.feedback.models import Feedback


def make_user(email, reg, **extra):
    return User.objects.create_user(email=email, registration_number=reg, password="TestPassword123", full_name="Beta Tester", **extra)


def client_for(user=None):
    client = APIClient()
    if user:
        client.force_authenticate(user)
    return client


@pytest.fixture
def student(db):
    return make_user("beta.student@iitrpr.ac.in", "2024CSM1090")


@pytest.fixture
def admin_user(db):
    return make_user("beta.admin@iitrpr.ac.in", "2024ADM1091", is_staff=True)


@pytest.mark.django_db
class TestSendingFeedback:
    def test_signed_in_user_can_send_feedback(self, student):
        res = client_for(student).post("/api/v1/feedback/", {"rating": 4, "message": "Search works well", "page": "/feed"}, format="json")
        assert res.status_code == 201, res.data
        entry = Feedback.objects.get()
        assert (entry.user, entry.rating, entry.page) == (student, 4, "/feed")

    def test_guests_cannot_send_feedback(self, db):
        assert client_for().post("/api/v1/feedback/", {"rating": 5, "message": "hi"}, format="json").status_code == 401

    @pytest.mark.parametrize("payload", [{"rating": 0, "message": "x"}, {"rating": 6, "message": "x"}, {"rating": 3, "message": ""}, {"message": "no rating"}])
    def test_invalid_feedback_is_rejected(self, student, payload):
        assert client_for(student).post("/api/v1/feedback/", payload, format="json").status_code == 400
        assert not Feedback.objects.exists()


@pytest.mark.django_db
class TestReadingFeedback:
    def test_admins_see_entries_and_average(self, student, admin_user):
        Feedback.objects.create(user=student, rating=5, message="Great")
        Feedback.objects.create(user=student, rating=2, message="Slow on mobile data")
        res = client_for(admin_user).get("/api/v1/feedback/")
        assert res.status_code == 200
        assert res.data["summary"] == {"count": 2, "average_rating": 3.5}
        assert res.data["data"][0]["message"] == "Slow on mobile data"  # newest first
        assert res.data["data"][0]["user_email"] == student.email

    def test_students_cannot_read_feedback(self, student):
        assert client_for(student).get("/api/v1/feedback/").status_code == 403


@pytest.mark.django_db
class TestHealth:
    def test_healthy_when_database_and_redis_answer(self):
        with mock.patch("config.views.redis.Redis.from_url") as from_url:
            from_url.return_value.ping.return_value = True
            res = client_for().get("/api/v1/health/")
        assert res.status_code == 200
        assert res.data == {"status": "ok", "checks": {"database": "ok", "redis": "ok"}}

    def test_unhealthy_when_redis_is_down(self):
        with mock.patch("config.views.redis.Redis.from_url", side_effect=ConnectionError("down")):
            res = client_for().get("/api/v1/health/")
        assert res.status_code == 503
        assert res.data["checks"]["redis"] == "unavailable"

    @override_settings(DEBUG=False, ALLOWED_HOSTS=["lostandfound.iitrpr.ac.in", "localhost"], SECURE_SSL_REDIRECT=True, SECURE_REDIRECT_EXEMPT=[r"^api/v1/health/$"])
    def test_container_check_over_plain_http_is_not_redirected(self):
        with mock.patch("config.views.redis.Redis.from_url") as from_url:
            from_url.return_value.ping.return_value = True
            res = client_for().get("/api/v1/health/", HTTP_HOST="localhost")
            other = client_for().get("/api/v1/posts/feed/", HTTP_HOST="localhost")
        assert res.status_code == 200
        assert other.status_code == 301  # everything else still goes to HTTPS


@pytest.mark.django_db
class TestAppConfig:
    @override_settings(MOBILE_MIN_SUPPORTED_VERSION="1.2.0", MOBILE_LATEST_VERSION="1.3.0", MOBILE_UPDATE_URL="https://example.com/app")
    def test_reports_versions_without_login(self):
        res = client_for().get("/api/v1/app-config/")
        assert res.status_code == 200
        assert res.data == {
            "success": True,
            "data": {"min_supported_version": "1.2.0", "latest_version": "1.3.0", "update_url": "https://example.com/app"},
        }
