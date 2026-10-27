"""
locustfile.py — Comprehensive Locust load testing suite for the IIT Ropar Lost & Found Portal.

Simulates realistic campus concurrent traffic across:
1. Public visitors browsing the feed, filtering categories, and performing searches.
2. QR code scanners resolving physical tags on campus belongings.
3. Authenticated students accessing profiles, checking unread alerts, and reporting belongings.
"""

import random
import uuid
from locust import HttpUser, between, task


CATEGORIES = ["electronics", "keys", "id_cards", "wallets", "books", "bicycle"]
SAMPLE_SEARCHES = ["key", "id card", "phone", "spectacles", "calculator", "bottle", "bag"]


class CampusVisitorUser(HttpUser):
    """Simulates unauthenticated students/visitors browsing public listings and scanning QR tags."""

    wait_time = between(1, 3)

    @task(5)
    def browse_public_feed(self):
        """Browse approved public feed."""
        self.client.get("/api/v1/posts/feed/", name="[Feed] List Approved Posts")

    @task(3)
    def filter_feed_by_category(self):
        """Filter feed items by specific category slug."""
        cat = random.choice(CATEGORIES)
        self.client.get(
            f"/api/v1/posts/feed/?category={cat}&type=all",
            name="[Feed] Filter Category",
        )

    @task(3)
    def search_feed(self):
        """Search feed by keyword."""
        term = random.choice(SAMPLE_SEARCHES)
        self.client.get(
            f"/api/v1/posts/feed/?search={term}",
            name="[Feed] Search Keywords",
        )

    @task(2)
    def get_categories(self):
        """Fetch categories list for filter bar."""
        self.client.get("/api/v1/posts/categories/", name="[Catalog] List Categories")

    @task(2)
    def scan_qr_valuable(self):
        """Resolve a campus valuable item sticker."""
        dummy_uuid = str(uuid.uuid4())
        self.client.get(
            f"/api/v1/items/qr/{dummy_uuid}/",
            name="[QR] Scan Item Sticker",
        )

    @task(1)
    def request_otp(self):
        """Request verification OTP for login/register."""
        self.client.post(
            "/api/v1/auth/request-otp/",
            json={"email": f"student_{random.randint(100, 999)}@iitrpr.ac.in", "purpose": "register"},
            name="[Auth] Request OTP",
        )


class AuthenticatedStudentUser(HttpUser):
    """Simulates logged-in campus members checking alerts, reports, and interacting."""

    wait_time = between(2, 5)

    def on_start(self):
        """Set up auth headers for student session."""
        self.token = None
        # Attempt login or generate test token headers
        res = self.client.post(
            "/api/v1/auth/login/",
            json={"email": "2026aim1023@iitrpr.ac.in", "password": "Student@123456"},
            name="[Auth] Student Login",
        )
        if res.status_code == 200:
            data = res.json()
            self.token = data.get("access")

    @property
    def headers(self):
        if self.token:
            return {"Authorization": f"Bearer {self.token}"}
        return {}

    @task(4)
    def check_notifications(self):
        """Poll unread notifications badge."""
        self.client.get(
            "/api/v1/notifications/unread-count/",
            headers=self.headers,
            name="[Notifications] Unread Count",
        )

    @task(3)
    def view_my_reports(self):
        """View user's submitted lost and found reports."""
        self.client.get(
            "/api/v1/posts/my/",
            headers=self.headers,
            name="[Posts] My Reports",
        )

    @task(2)
    def view_my_valuables(self):
        """View user's registered campus valuables."""
        self.client.get(
            "/api/v1/items/",
            headers=self.headers,
            name="[Valuables] List Belongings",
        )

    @task(2)
    def view_conversations(self):
        """List active handover chat threads."""
        self.client.get(
            "/api/v1/chat/conversations/",
            headers=self.headers,
            name="[Chat] List Conversations",
        )
