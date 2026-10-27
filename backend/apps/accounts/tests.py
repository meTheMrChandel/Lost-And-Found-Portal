import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from apps.accounts.models import OTP
from apps.accounts.utils import create_otp

User = get_user_model()

@pytest.fixture
def client():
    return APIClient()

@pytest.fixture
def test_user(db):
    return User.objects.create_user(
        email="2024csm1010@iitrpr.ac.in",
        registration_number="2024CSM1010",
        password="ValidPassword123",
        full_name="Test Student",
    )

@pytest.mark.django_db
class TestPhase1AuthenticationAPI:

    def test_request_otp_invalid_domain_rejected(self, client):
        """Requesting OTP with non-IIT Ropar domain returns 400."""
        res = client.post("/api/v1/auth/request-otp/", {"email": "baduser@gmail.com"})
        assert res.status_code == 400
        assert not res.data.get("success")

    def test_request_otp_valid_email_success(self, client):
        """Requesting OTP with valid @iitrpr.ac.in succeeds."""
        res = client.post("/api/v1/auth/request-otp/", {
            "email": "newstudent@iitrpr.ac.in",
            "purpose": "registration"
        })
        assert res.status_code == 200
        assert res.data["success"] is True
        assert OTP.objects.filter(email="newstudent@iitrpr.ac.in").exists()

    def test_otp_lockout_after_three_failures(self, client):
        """OTP locks after 3 failed attempts."""
        email = "lockouttest@iitrpr.ac.in"
        create_otp(email=email, purpose="registration")

        # Attempt with wrong code 3 times
        for _ in range(3):
            client.post("/api/v1/auth/verify-otp/", {
                "email": email,
                "code": "000000",
                "purpose": "registration"
            })

        otp = OTP.objects.filter(email=email).latest("created_at")
        assert otp.attempts >= 3
        assert otp.is_locked()

    def test_successful_registration_and_login(self, client):
        """User registers and logs in to receive JWT tokens."""
        reg_payload = {
            "email": "freshreg@iitrpr.ac.in",
            "password": "StrongPassword987",
            "registration_number": "2024CSM1020",
            "full_name": "Fresh Student",
            "department": "CSE",
            "program_year": "MTECH_1",
            "hostel": "Satluj",
        }
        reg_res = client.post("/api/v1/auth/register/", reg_payload)
        assert reg_res.status_code == 201
        assert reg_res.data["success"] is True

        login_res = client.post("/api/v1/auth/login/", {
            "email": "freshreg@iitrpr.ac.in",
            "password": "StrongPassword987"
        })
        assert login_res.status_code == 200
        assert "access" in login_res.data
        assert "refresh" in login_res.data
        assert login_res.data["user"]["full_name"] == "Fresh Student"

    def test_authenticated_profile_endpoint(self, client, test_user):
        """Authenticated user can fetch their personal profile."""
        client.force_authenticate(user=test_user)
        res = client.get("/api/v1/users/me/")
        assert res.status_code == 200
        assert res.data["data"]["email"] == test_user.email
        assert res.data["data"]["registration_number"] == test_user.registration_number

    def test_mobile_bearer_token_authorization_and_refresh(self, client, test_user):
        """Mobile clients authenticate with Bearer tokens and refresh tokens when expired."""
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(test_user)
        access_token = str(refresh.access_token)

        # 1. Access protected profile using Mobile Bearer Header
        res = client.get(
            "/api/v1/users/me/",
            HTTP_AUTHORIZATION=f"Bearer {access_token}"
        )
        assert res.status_code == 200
        assert res.data["data"]["email"] == test_user.email

        # 2. Refresh token endpoint issues a new valid access token
        refresh_res = client.post(
            "/api/v1/auth/token/refresh/",
            {"refresh": str(refresh)}
        )
        assert refresh_res.status_code == 200
        assert "access" in refresh_res.data
        new_access_token = refresh_res.data["access"]

        # 3. New token successfully accesses API
        res_refreshed = client.get(
            "/api/v1/users/me/",
            HTTP_AUTHORIZATION=f"Bearer {new_access_token}"
        )
        assert res_refreshed.status_code == 200

    def test_security_headers_enforced(self, client):
        """Security headers (nosniff, X-Frame-Options) are strictly present on responses."""
        res = client.get("/api/v1/auth/request-otp/")
        assert res.headers.get("X-Content-Type-Options") == "nosniff"
        assert res.headers.get("X-Frame-Options") == "DENY"

    def test_rate_limiting_otp_request_throttle(self, client):
        """Requesting OTP in rapid burst triggers 429 Too Many Requests."""
        from django.core.cache import cache
        cache.clear()

        # The rate limit is 5/minute. The 6th request within a minute must be throttled with 429.
        statuses = []
        for _ in range(7):
            res = client.post(
                "/api/v1/auth/request-otp/",
                {"email": "throttletest@iitrpr.ac.in", "purpose": "register"},
            )
            statuses.append(res.status_code)

        assert 429 in statuses
        cache.clear()
