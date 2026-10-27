"""
apps/posts/test_e2e_user_journeys.py — Comprehensive End-to-End User Journeys Simulation.

Simulates real student, finder, and security administrator user behaviors across all features:
1. Authentication & Registration lifecycle (OTP, verify, register, login, refresh, profile)
2. Discovery & Feed browsing (categories, search query, category filtering)
3. Lost Item Posting with confidential proof questions
4. Found Item Posting with custody location tracking
5. Automated Matching engine candidate generation & audit trail
6. Valuables Registry & Anonymous QR Code generation & resolution
7. Secure Chat Messaging with read receipts and ?since= timestamp catchup
8. Notifications & badge counters
"""

import uuid
from datetime import date, timedelta
from decimal import Decimal
import pytest
from django.core.management import call_command
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User, OTP
from apps.accounts.utils import create_otp
from apps.posts.models import Category, Post, SiteSettings
from apps.items.models import RegisteredItem
from apps.matching.services import run_matching
from apps.matching.models import Match
from apps.chat.models import Conversation, Message
from apps.notifications.models import Notification


@pytest.fixture(autouse=True)
def setup_seed():
    call_command("seed_data")


@pytest.fixture
def client():
    return APIClient()


@pytest.mark.django_db
class TestEndToEndUserJourneys:

    def test_journey_1_auth_lifecycle(self, client):
        """Simulate a complete student onboarding journey from OTP to profile update."""
        email = "2026aim8888@iitrpr.ac.in"
        password = "StudentPass@12345"

        # Step 1.1: Request OTP
        resp_otp = client.post("/api/v1/auth/request-otp/", {"email": email, "purpose": "registration"})
        assert resp_otp.status_code == status.HTTP_200_OK

        # Generate valid test OTP for verification
        test_code = create_otp(email=email, purpose="registration")

        # Step 1.2: Verify OTP
        resp_verify = client.post("/api/v1/auth/verify-otp/", {
            "email": email,
            "purpose": "registration",
            "code": test_code,
        })
        assert resp_verify.status_code == status.HTTP_200_OK

        # Step 1.3: Complete Registration
        resp_reg = client.post("/api/v1/auth/register/", {
            "email": email,
            "password": password,
            "full_name": "Rohan Deshmukh",
            "registration_number": "2026AIM8888",
            "department": "CSE",
            "phone": "+919876543210",
        })
        assert resp_reg.status_code == status.HTTP_201_CREATED

        # Step 1.4: Login with credentials
        resp_login = client.post("/api/v1/auth/login/", {
            "email": email,
            "password": password,
        })
        assert resp_login.status_code == status.HTTP_200_OK
        access_token = resp_login.data["access"]
        refresh_token = resp_login.data["refresh"]
        assert access_token is not None

        # Step 1.5: Refresh Token
        resp_refresh = client.post("/api/v1/auth/token/refresh/", {"refresh": refresh_token})
        assert resp_refresh.status_code == status.HTTP_200_OK
        new_access = resp_refresh.data["access"]
        assert new_access is not None

        # Step 1.6: Fetch own profile (verified via both auth/me and users/me)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {new_access}")
        resp_me = client.get("/api/v1/users/me/")
        assert resp_me.status_code == status.HTTP_200_OK
        me_data = resp_me.data.get("data", resp_me.data)
        assert me_data["email"] == email
        assert me_data["full_name"] == "Rohan Deshmukh"

        resp_me_auth = client.get("/api/v1/auth/me/")
        assert resp_me_auth.status_code == status.HTTP_200_OK

    def test_journey_2_feed_and_discovery(self, client):
        """Simulate browsing feed, fetching categories, and searching."""
        # Step 2.1: Categories
        resp_cats = client.get("/api/v1/posts/categories/")
        assert resp_cats.status_code == status.HTTP_200_OK
        cats = resp_cats.data.get("data", resp_cats.data)
        assert len(cats) >= 5

        # Step 2.2: List active feed (as guest)
        resp_feed = client.get("/api/v1/posts/feed/")
        assert resp_feed.status_code == status.HTTP_200_OK

        # Step 2.3: Search feed
        resp_search = client.get("/api/v1/posts/feed/?q=bicycle")
        assert resp_search.status_code == status.HTTP_200_OK

    def test_journey_3_and_4_report_and_matching(self, client):
        """Simulate student reporting lost laptop and finder reporting found laptop, followed by match calculation."""
        student_owner = User.objects.create_user(
            email="owner_e2e@iitrpr.ac.in",
            password="Password@123",
            full_name="Owner Student",
            registration_number="2024CSM1001",
        )
        student_owner.is_email_verified = True
        student_owner.save()

        finder_student = User.objects.create_user(
            email="finder_e2e@iitrpr.ac.in",
            password="Password@123",
            full_name="Finder Student",
            registration_number="2024CSM1002",
        )
        finder_student.is_email_verified = True
        finder_student.save()

        now = timezone.now() - timedelta(hours=2)

        # Step 3.1: Student logs in and reports Lost Laptop with secret question
        client.force_authenticate(user=student_owner)
        lost_data = {
            "title": "Lost Space Grey MacBook Pro 14",
            "description": "Left on table 4 at Central Library 2nd floor with robotics stickers.",
            "category": "laptop",
            "last_seen_place": "Central Library 2nd Floor",
            "last_seen_time": now.isoformat(),
            "hidden_proof": "IIT Ropar Robotics Club sticker on bottom right",
            "reward_amount": "500.00",
        }
        resp_lost = client.post("/api/v1/posts/lost/", lost_data, format="json")
        assert resp_lost.status_code == status.HTTP_201_CREATED
        lost_post_id = resp_lost.data["data"]["id"]

        # Step 4.1: Finder logs in and reports Found Laptop with custody info
        client.force_authenticate(user=finder_student)
        found_data = {
            "title": "Found Space Grey Apple MacBook",
            "description": "Found on table 4 at Central Library 2nd floor with robotics stickers.",
            "category": "laptop",
            "last_seen_place": "Central Library 2nd Floor",
            "last_seen_time": now.isoformat(),
            "custody_location": "finder",
            "inform_admin_privately": False,
        }
        resp_found = client.post("/api/v1/posts/found/", found_data, format="json")
        assert resp_found.status_code == status.HTTP_201_CREATED
        found_post_id = resp_found.data["data"]["id"]

        # Step 5: Matching Engine execution
        match_result = run_matching()
        assert match_result.get("matches_created", 0) >= 1 or match_result.get("scanned_pairs", 0) >= 1

        match_record = Match.objects.filter(lost_post_id=lost_post_id, found_post_id=found_post_id).first()
        assert match_record is not None
        assert match_record.score >= 0.70

    def test_journey_5_valuables_and_qr_scanning(self, client):
        """Simulate student registering valuable bike, generating QR, and anonymous finder scan."""
        student = User.objects.create_user(
            email="bike_owner@iitrpr.ac.in",
            password="Password@123",
            full_name="Bike Owner",
            registration_number="2024CSM1003",
        )
        student.is_email_verified = True
        student.save()

        # Step 6.1: Register valuable item
        client.force_authenticate(user=student)
        resp_item = client.post("/api/v1/items/", {
            "name": "Firefox Target 29 D Mountain Bicycle",
            "category": "bicycle",
            "serial_number": "FX2024-998811",
            "description": "Matte black with orange rim tape.",
        }, format="json")
        assert resp_item.status_code == status.HTTP_201_CREATED
        item_id = resp_item.data["data"]["id"]
        qr_uuid = resp_item.data["data"]["qr_uuid"]

        # Step 6.2: Retrieve QR sticker JSON/SVG
        resp_sticker = client.get(f"/api/v1/items/{item_id}/sticker/?format=json")
        assert resp_sticker.status_code == status.HTTP_200_OK
        assert "<svg" in resp_sticker.data["svg"]

        # Step 6.3: Anonymous Samaritan scans QR token
        client.force_authenticate(user=None)
        resp_scan = client.get(f"/api/v1/items/scan/{qr_uuid}/")
        assert resp_scan.status_code == status.HTTP_200_OK
        data = resp_scan.data["data"]
        # Verify privacy: phone number is concealed
        assert "phone_number" not in data
        assert data["item_name"] == "Firefox Target 29 D Mountain Bicycle"

    def test_journey_6_chat_and_notifications(self, client):
        """Simulate conversation between finder and owner for a match case with notifications."""
        user_a = User.objects.create_user(
            email="chatter_a@iitrpr.ac.in",
            password="Password@123",
            full_name="Chatter A",
            registration_number="2024CSM1004",
        )
        user_b = User.objects.create_user(
            email="chatter_b@iitrpr.ac.in",
            password="Password@123",
            full_name="Chatter B",
            registration_number="2024CSM1005",
        )
        admin = User.objects.create_user(
            email="admin_chat@iitrpr.ac.in",
            password="Password@123",
            full_name="Campus Admin",
            registration_number="2020ADM0099",
            is_staff=True,
        )
        cat = Category.objects.get(slug="keys")
        now = timezone.now() - timedelta(hours=1)
        lost_post = Post.objects.create(
            author=user_a,
            category=cat,
            title="Lost Hostel Room 204 Keys",
            description="Silver Godrej key with blue tag.",
            post_type=Post.PostType.LOST,
            last_seen_time=now,
            last_seen_place="Satluj Hostel",
            status=Post.Status.APPROVED,
        )
        found_post = Post.objects.create(
            author=user_b,
            category=cat,
            title="Found Room Keys with Blue Tag",
            description="Keys found near dining table.",
            post_type=Post.PostType.FOUND,
            last_seen_time=now,
            last_seen_place="Satluj Hostel Dining Hall",
            status=Post.Status.APPROVED,
        )
        match = Match.objects.create(
            lost_post=lost_post,
            found_post=found_post,
            score=0.92,
            status=Match.Status.SUGGESTED,
        )

        # Step 7.1: Finder contacts Admin regarding the match
        client.force_authenticate(user=user_b)
        resp_conv_finder = client.post("/api/v1/chat/conversations/", {
            "match_id": str(match.id),
            "conversation_type": Conversation.ConversationType.FINDER_ADMIN,
        })
        assert resp_conv_finder.status_code in [status.HTTP_200_OK, status.HTTP_201_CREATED]

        # Step 7.2: Campus Administrator verifies match and initiates direct chat between finder and owner
        client.force_authenticate(user=admin)
        resp_conv_direct = client.post("/api/v1/chat/conversations/", {
            "match_id": str(match.id),
            "conversation_type": Conversation.ConversationType.DIRECT,
        })
        assert resp_conv_direct.status_code in [status.HTTP_200_OK, status.HTTP_201_CREATED]
        conv_id = resp_conv_direct.data["data"]["id"]

        # Step 7.3: Send message from Finder (User B) to Owner (User A)
        client.force_authenticate(user=user_b)
        resp_msg1 = client.post(f"/api/v1/chat/conversations/{conv_id}/messages/", {
            "content": "Hi! I found your hostel keys near the dining hall entrance.",
        })
        assert resp_msg1.status_code == status.HTTP_201_CREATED

        # Step 7.4: User A reads and replies
        client.force_authenticate(user=user_a)
        resp_read = client.post(f"/api/v1/chat/conversations/{conv_id}/read/")
        assert resp_read.status_code == status.HTTP_200_OK

        resp_msg2 = client.post(f"/api/v1/chat/conversations/{conv_id}/messages/", {
            "content": "Thank you so much! Can I collect it from you at 6 PM?",
        })
        assert resp_msg2.status_code == status.HTTP_201_CREATED

        # Step 7.5: Verify offline catchup query with ?since=
        past_time = (timezone.now() - timedelta(minutes=5)).isoformat()
        resp_sync = client.get(f"/api/v1/chat/conversations/{conv_id}/messages/?since={past_time}")
        assert resp_sync.status_code == status.HTTP_200_OK
        messages = resp_sync.data.get("data", resp_sync.data)
        assert len(messages) >= 2

        # Step 7.6: Notifications check
        resp_count = client.get("/api/v1/notifications/unread-count/")
        assert resp_count.status_code == status.HTTP_200_OK

        resp_mark = client.post("/api/v1/notifications/mark-all-read/")
        assert resp_mark.status_code == status.HTTP_200_OK
