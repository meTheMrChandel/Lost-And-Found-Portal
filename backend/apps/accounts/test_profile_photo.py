"""
accounts/test_profile_photo.py — Profile photos get the same size and type limits as report photos.
"""

import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from apps.accounts.models import User


@pytest.fixture
def client(db):
    user = User.objects.create_user(
        email="photo.user@iitrpr.ac.in", registration_number="2024CSM1300", password="TestPassword123", full_name="Photo User"
    )
    c = APIClient()
    c.force_authenticate(user)
    c.user = user
    return c


def png_bytes():
    buf = io.BytesIO()
    Image.new("RGB", (8, 8), "green").save(buf, format="PNG")
    return buf.getvalue()


@pytest.mark.django_db
class TestProfilePhoto:
    def test_upload_a_real_image(self, client, tmp_path, settings):
        settings.MEDIA_ROOT = tmp_path
        res = client.patch("/api/v1/users/me/", {"photo": SimpleUploadedFile("me.png", png_bytes(), "image/png")}, format="multipart")
        assert res.status_code == 200, res.data
        client.user.refresh_from_db()
        assert client.user.photo.name.startswith("profiles/")
        assert res.data["data"]["photo"]

    def test_a_script_renamed_to_png_is_rejected(self, client):
        fake = SimpleUploadedFile("me.png", b"<script>alert(1)</script>", "image/png")
        res = client.patch("/api/v1/users/me/", {"photo": fake}, format="multipart")
        assert res.status_code == 400

    def test_oversized_photo_is_rejected(self, client):
        big = SimpleUploadedFile("big.png", png_bytes() + b"0" * (5 * 1024 * 1024), "image/png")
        res = client.patch("/api/v1/users/me/", {"photo": big}, format="multipart")
        assert res.status_code == 400
        assert "5MB" in str(res.data)
