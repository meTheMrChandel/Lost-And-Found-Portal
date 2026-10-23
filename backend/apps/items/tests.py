"""
items/tests.py — Automated test suite for Phase 7: QR System & Registered Items.
"""

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.posts.models import Category
from apps.items.models import RegisteredItem


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def student_user(db):
    user = User.objects.create_user(
        email="rahul_bicycle@iitrpr.ac.in",
        password="ValidPassword@123",
        full_name="Rahul Verma",
        registration_number="2024CSM1033",
    )
    user.is_email_verified = True
    user.save()
    return user


@pytest.fixture
def other_student(db):
    user = User.objects.create_user(
        email="priya_laptop@iitrpr.ac.in",
        password="ValidPassword@123",
        full_name="Priya Sharma",
        registration_number="2024CSM1034",
    )
    user.is_email_verified = True
    user.save()
    return user


@pytest.fixture
def admin_user(db):
    user = User.objects.create_user(
        email="admin_scanner@iitrpr.ac.in",
        password="AdminPassword@123",
        full_name="Staff Inspector",
        registration_number="2020ADM0002",
        is_staff=True,
    )
    user.is_email_verified = True
    user.is_campus_admin = True
    user.save()
    return user


@pytest.fixture
def category_bicycle(db):
    cat, _ = Category.objects.get_or_create(
        slug="bicycle",
        defaults={"name": "Bicycle", "icon": "bike", "is_sensitive": False},
    )
    return cat


@pytest.mark.django_db
class TestPhase7QRSystem:
    """Tests for Phase 7: QR item registration, zero-knowledge privacy scans, and sticker generator."""

    def test_register_valuable_item_generates_unique_qr_uuid(
        self, api_client, student_user, category_bicycle
    ):
        """Student registers valuable item and receives QR UUID and scan URL."""
        api_client.force_authenticate(user=student_user)

        payload = {
            "name": "Firefox Mountain Bike Red",
            "category": "bicycle",
            "description": "Red and black 21-speed mountain bike with front suspension",
            "serial_number": "FF-2024-ROPAR-9821",
        }

        res = api_client.post("/api/v1/items/", payload)
        assert res.status_code == status.HTTP_201_CREATED
        data = res.data["data"]

        assert data["name"] == "Firefox Mountain Bike Red"
        assert data["qr_uuid"] != ""
        assert "/scan/" in data["scan_url"]
        assert data["is_active"] is True

        # Verify DB
        item = RegisteredItem.objects.get(id=data["id"])
        assert item.owner == student_user
        assert item.serial_number == "FF-2024-ROPAR-9821"

    def test_public_qr_scan_returns_only_whitelisted_fields(
        self, api_client, student_user, category_bicycle
    ):
        """
        Public scan page strictly exposes only whitelisted fields:
          item_name, category, owner_name, qr_uuid, is_active.
        Strictly conceals phone number, email, registration number, and serial number.
        """
        item = RegisteredItem.objects.create(
            owner=student_user,
            category=category_bicycle,
            name="Hero Sprint Cycle",
            description="Blue gear bicycle",
            serial_number="SECRET-SERIAL-9999",
        )

        # Unauthenticated request from any public mobile phone
        res = api_client.get(f"/api/v1/items/scan/{item.qr_uuid}/")
        assert res.status_code == status.HTTP_200_OK

        payload = res.data["data"]
        assert payload["item_name"] == "Hero Sprint Cycle"
        assert payload["category"] == "Bicycle"
        assert payload["owner_name"] == "Rahul Verma"
        assert payload["qr_uuid"] == str(item.qr_uuid)
        assert payload["is_active"] is True

        # Zero-knowledge privacy guarantees
        raw_response_text = str(res.data)
        assert "SECRET-SERIAL-9999" not in raw_response_text
        assert "rahul_bicycle@iitrpr.ac.in" not in raw_response_text
        assert "2024CSM1033" not in raw_response_text
        assert "phone" not in payload

    def test_deactivated_qr_shows_neutral_message(
        self, api_client, student_user, category_bicycle
    ):
        """When an owner deactivates an item QR, public scan returns neutral notice."""
        item = RegisteredItem.objects.create(
            owner=student_user,
            category=category_bicycle,
            name="Deactivated Cycle",
            is_active=False,
        )

        res = api_client.get(f"/api/v1/items/scan/{item.qr_uuid}/")
        assert res.status_code == status.HTTP_200_OK
        assert res.data["is_active"] is False
        assert "deactivated" in res.data["message"].lower()
        # Owner name must not be disclosed when deactivated
        assert "owner_name" not in res.data

    def test_owner_can_toggle_active_status(
        self, api_client, student_user, other_student, category_bicycle
    ):
        """Owner can toggle active/deactivated state; other students are forbidden."""
        item = RegisteredItem.objects.create(
            owner=student_user,
            category=category_bicycle,
            name="Toggleable Cycle",
            is_active=True,
        )

        # Other student blocked
        api_client.force_authenticate(user=other_student)
        res_intruder = api_client.post(f"/api/v1/items/{item.id}/toggle-active/")
        assert res_intruder.status_code in [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN]

        # Owner toggles to inactive
        api_client.force_authenticate(user=student_user)
        res_deact = api_client.post(f"/api/v1/items/{item.id}/toggle-active/")
        assert res_deact.status_code == status.HTTP_200_OK
        item.refresh_from_db()
        assert item.is_active is False
        assert item.deactivated_at is not None

        # Owner reactivates
        res_react = api_client.post(f"/api/v1/items/{item.id}/toggle-active/")
        assert res_react.status_code == status.HTTP_200_OK
        item.refresh_from_db()
        assert item.is_active is True
        assert item.deactivated_at is None

    def test_printable_qr_sticker_generation(
        self, api_client, student_user, category_bicycle
    ):
        """Printable QR sticker endpoint returns valid SVG and JSON payloads."""
        item = RegisteredItem.objects.create(
            owner=student_user,
            category=category_bicycle,
            name="Printable Sticker Laptop",
        )

        api_client.force_authenticate(user=student_user)

        # 1. Raw SVG output for printing
        res_svg = api_client.get(f"/api/v1/items/{item.id}/sticker/")
        assert res_svg.status_code == status.HTTP_200_OK
        assert "image/svg+xml" in res_svg["Content-Type"]
        assert "<svg" in res_svg.content.decode("utf-8")

        # 2. JSON output for web UI embedding
        res_json = api_client.get(f"/api/v1/items/{item.id}/sticker/?format=json")
        assert res_json.status_code == status.HTTP_200_OK
        assert res_json.data["item_id"] == str(item.id)
        assert "<svg" in res_json.data["svg"]
        assert str(item.qr_uuid) in res_json.data["scan_url"]

    def test_admin_registered_items_search_by_name_and_registration_number(
        self, api_client, admin_user, student_user, category_bicycle
    ):
        """Admin can search registered valuables across all students by name, reg number, or serial number."""
        item = RegisteredItem.objects.create(
            owner=student_user,
            category=category_bicycle,
            name="Specialized Allez Road Bike",
            serial_number="SPEC-ROAD-7711",
        )

        # Regular student forbidden
        api_client.force_authenticate(user=student_user)
        res_forbidden = api_client.get("/api/v1/items/admin/")
        assert res_forbidden.status_code == status.HTTP_403_FORBIDDEN

        # Admin search by student registration number
        api_client.force_authenticate(user=admin_user)
        res_search_reg = api_client.get("/api/v1/items/admin/?search=2024CSM1033")
        assert res_search_reg.status_code == status.HTTP_200_OK
        results = res_search_reg.data.get("results", res_search_reg.data)
        assert any(it["id"] == str(item.id) for it in results)

        # Admin search by serial number
        res_search_serial = api_client.get("/api/v1/items/admin/?search=SPEC-ROAD-7711")
        assert res_search_serial.status_code == status.HTTP_200_OK
        results_serial = res_search_serial.data.get("results", res_search_serial.data)
        assert any(it["id"] == str(item.id) for it in results_serial)
