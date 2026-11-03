"""
posts/test_qr_found_reports.py — A found report started from a QR sticker is linked to the
registered item, and its owner is told straight away, even without a lost report to match.
"""

import uuid

import pytest
from django.core import mail
from django.core.management import call_command
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.items.models import RegisteredItem
from apps.notifications.models import Notification
from apps.posts.models import Category, Post


def make_user(email, reg, **extra):
    return User.objects.create_user(email=email, registration_number=reg, password="TestPassword123", full_name=email.split(".")[0].title(), **extra)


@pytest.fixture
def setup(db):
    call_command("seed_data")
    owner = make_user("owner.qr@iitrpr.ac.in", "2024CSM1700")
    finder = make_user("finder.qr@iitrpr.ac.in", "2024CSM1701")
    admin = make_user("admin.qr@iitrpr.ac.in", "2024ADM1702", is_staff=True)
    bike = RegisteredItem.objects.create(owner=owner, name="Hero Sprint bicycle", category=Category.objects.get(slug="bicycle"), serial_number="HS-123")
    return owner, finder, admin, bike


def report_found(user, **extra):
    client = APIClient()
    client.force_authenticate(user)
    payload = {"title": "Found: Hero Sprint bicycle", "category": "bicycle", "description": "Black bicycle near the gym",
               "last_seen_place": "Gym parking", "custody_location": "security_office", **extra}
    return client.post("/api/v1/posts/found/", payload, format="json")


@pytest.mark.django_db
class TestFoundFromSticker:
    def test_owner_is_told_immediately_and_the_report_is_linked(self, setup):
        owner, finder, admin, bike = setup
        res = report_found(finder, qr_uuid=str(bike.qr_uuid))
        assert res.status_code == 201, res.data
        post = Post.objects.get(pk=res.data["data"]["id"])
        assert post.registered_item == bike

        note = Notification.objects.get(recipient=owner)
        assert note.title == 'Someone found your "Hero Sprint bicycle"'
        assert "security office" in note.body
        assert finder.full_name not in note.body and finder.email not in note.body
        assert any(owner.email in m.to for m in mail.outbox)

    def test_admins_see_whose_sticker_it_was(self, setup):
        owner, finder, admin, bike = setup
        post_id = report_found(finder, qr_uuid=str(bike.qr_uuid)).data["data"]["id"]
        assert f"QR sticker on {owner.full_name}'s" in Notification.objects.get(recipient=admin).body
        client = APIClient()
        client.force_authenticate(admin)
        detail = client.get(f"/api/v1/adminpanel/posts/{post_id}/").data["data"]
        assert detail["registered_item"]["owner_email"] == owner.email
        assert detail["registered_item"]["name"] == "Hero Sprint bicycle"

    def test_reporting_your_own_sticker_does_not_notify_you_as_owner(self, setup):
        owner, finder, admin, bike = setup
        assert report_found(owner, qr_uuid=str(bike.qr_uuid)).status_code == 201
        titles = list(Notification.objects.filter(recipient=owner).values_list("title", flat=True))
        assert titles == ["We received your report"]

    def test_unknown_and_deactivated_stickers_are_refused(self, setup):
        owner, finder, admin, bike = setup
        res = report_found(finder, qr_uuid=str(uuid.uuid4()))
        assert res.status_code == 400 and "isn't registered" in str(res.data)
        RegisteredItem.objects.filter(pk=bike.pk).update(is_active=False)
        res = report_found(finder, qr_uuid=str(bike.qr_uuid))
        assert res.status_code == 400 and "deactivated" in str(res.data)
        assert not Post.objects.exists()

    def test_ordinary_found_report_is_unchanged(self, setup):
        owner, finder, admin, bike = setup
        res = report_found(finder)
        assert res.status_code == 201
        assert Post.objects.get(pk=res.data["data"]["id"]).registered_item is None
        assert not Notification.objects.filter(recipient=owner).exists()


@pytest.mark.django_db
class TestReporterConfirmation:
    def test_every_reporter_gets_an_in_app_receipt(self, setup):
        owner, finder, admin, bike = setup
        report_found(finder)
        client = APIClient()
        client.force_authenticate(owner)
        client.post("/api/v1/posts/lost/", {"title": "Lost keys", "category": "keys", "description": "Three keys",
                                            "last_seen_place": "Library", "hidden_proof": "Red tag"}, format="json")
        for user in (finder, owner):
            assert Notification.objects.filter(recipient=user, title="We received your report").count() == 1
        # In-app only: the receipt itself is not emailed
        assert not any(m.subject.endswith("We received your report") for m in mail.outbox)


def scan(bike, user=None):
    client = APIClient()
    if user:
        client.force_authenticate(user)
    return client.get(f"/api/v1/items/scan/{bike.qr_uuid}/")


@pytest.mark.django_db
class TestScanningSomeoneElsesSticker:
    def test_owner_is_told_and_the_scanner_is_not(self, setup):
        owner, finder, admin, bike = setup
        assert scan(bike, finder).status_code == 200
        note = Notification.objects.get(recipient=owner)
        assert note.title == 'Your "Hero Sprint bicycle" QR sticker was scanned'
        assert finder.email not in note.body and finder.full_name not in note.body
        assert not Notification.objects.filter(recipient=finder).exists()

    def test_scanner_gets_nothing_when_reporting_it_found_either(self, setup):
        owner, finder, admin, bike = setup
        scan(bike, finder)
        assert report_found(finder, qr_uuid=str(bike.qr_uuid)).status_code == 201
        assert not Notification.objects.filter(recipient=finder).exists()
        assert set(Notification.objects.filter(recipient=owner).values_list("title", flat=True)) == {
            'Your "Hero Sprint bicycle" QR sticker was scanned',
            'Someone found your "Hero Sprint bicycle"',
        }

    def test_repeat_scans_within_half_an_hour_stay_quiet(self, setup):
        owner, finder, admin, bike = setup
        for _ in range(3):
            scan(bike, finder)
        scan(bike)  # and a phone camera scan without signing in
        assert Notification.objects.filter(recipient=owner).count() == 1

    def test_a_scan_after_the_quiet_period_notifies_again(self, setup):
        from datetime import timedelta
        from unittest import mock
        from django.utils import timezone

        owner, finder, admin, bike = setup
        with mock.patch("django.utils.timezone.now", return_value=timezone.now() - timedelta(minutes=45)):
            scan(bike, finder)
        scan(bike, finder)
        assert Notification.objects.filter(recipient=owner).count() == 2

    def test_anonymous_camera_scan_still_tells_the_owner(self, setup):
        owner, finder, admin, bike = setup
        assert scan(bike).status_code == 200
        assert Notification.objects.filter(recipient=owner).count() == 1

    def test_owner_scanning_their_own_sticker_is_silent(self, setup):
        owner, finder, admin, bike = setup
        scan(bike, owner)
        assert not Notification.objects.exists()

    def test_deactivated_sticker_scans_tell_nobody(self, setup):
        owner, finder, admin, bike = setup
        RegisteredItem.objects.filter(pk=bike.pk).update(is_active=False)
        scan(bike, finder)
        assert not Notification.objects.exists()
