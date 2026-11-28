import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.accounts.models import OTP
from apps.accounts.utils import create_otp

User = get_user_model()
URL = "/api/v1/auth/password-reset-confirm/"


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email="2024csm1011@iitrpr.ac.in",
        registration_number="2024CSM1011",
        password="OldPassword123",
        full_name="Reset Student",
    )


@pytest.mark.django_db
class TestPasswordResetConfirm:

    def test_valid_code_changes_password(self, user):
        code = create_otp(user.email, OTP.Purpose.PASSWORD_RESET, user=user)
        res = APIClient().post(URL, {"email": user.email, "code": code, "new_password": "NewPassword456"})
        assert res.status_code == 200
        assert res.data["success"] is True
        user.refresh_from_db()
        assert user.check_password("NewPassword456")

    def test_wrong_code_is_rejected(self, user):
        code = create_otp(user.email, OTP.Purpose.PASSWORD_RESET, user=user)
        wrong = "000000" if code != "000000" else "111111"
        res = APIClient().post(URL, {"email": user.email, "code": wrong, "new_password": "NewPassword456"})
        assert res.status_code == 400
        assert res.data["code"] == "invalid_otp"
        user.refresh_from_db()
        assert user.check_password("OldPassword123")

    def test_registration_code_cannot_reset_password(self, user):
        code = create_otp(user.email, OTP.Purpose.REGISTRATION, user=user)
        res = APIClient().post(URL, {"email": user.email, "code": code, "new_password": "NewPassword456"})
        assert res.status_code == 400
        user.refresh_from_db()
        assert user.check_password("OldPassword123")
