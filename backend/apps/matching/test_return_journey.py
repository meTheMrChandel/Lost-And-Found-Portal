"""
matching/test_return_journey.py — The core flow end to end, through the API the apps use:
lost report -> found report -> approval -> matching -> confirm -> proof -> handover -> closed.
"""

from datetime import timedelta

import pytest
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.matching.models import Match
from apps.notifications.models import Notification
from apps.posts.models import Post


def client_for(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


@pytest.fixture
def people(db):
    call_command("seed_data")
    make = lambda email, reg, **x: User.objects.create_user(email=email, registration_number=reg, password="TestPassword123", full_name=email.split("@")[0], **x)
    return make("journey.owner@iitrpr.ac.in", "2024CSM1600"), make("journey.finder@iitrpr.ac.in", "2024CSM1601"), make("journey.admin@iitrpr.ac.in", "2024ADM1602", is_staff=True)


def kinds(user):
    return set(Notification.objects.filter(recipient=user).values_list("notif_type", flat=True))


@pytest.mark.django_db
def test_lost_item_is_matched_verified_and_returned(people):
    owner, finder, admin = people
    seen = (timezone.now() - timedelta(hours=3)).isoformat()

    lost = client_for(owner).post("/api/v1/posts/lost/", {
        "title": "Steel Milton bottle", "category": "bottle", "description": "Steel Milton bottle, blue cap, dent near the bottom",
        "last_seen_place": "Central library second floor", "last_seen_time": seen,
        "hidden_proof": "Red star sticker under the lid", "reward_amount": "100",
    }, format="json")
    found = client_for(finder).post("/api/v1/posts/found/", {
        "title": "Found steel bottle", "category": "bottle", "description": "Steel Milton bottle with a blue cap, small dent",
        "last_seen_place": "Central library reading room", "last_seen_time": seen, "custody_location": "admin_office",
    }, format="json")
    assert lost.status_code == found.status_code == 201
    lost_id, found_id = lost.data["data"]["id"], found.data["data"]["id"]

    staff = client_for(admin)
    for post_id in (lost_id, found_id):
        assert staff.post(f"/api/v1/adminpanel/posts/{post_id}/review/", {"action": "APPROVE"}, format="json").status_code == 200

    assert staff.post("/api/v1/matching/run/").status_code == 200
    match = Match.objects.get(lost_post_id=lost_id, found_post_id=found_id)
    assert match.status == Match.Status.SUGGESTED

    assert staff.post(f"/api/v1/matching/{match.id}/action/", {"action": "CONFIRM"}, format="json").status_code == 200

    wrong = [{"question": "What is under the lid?", "answer": "Nothing", "is_correct": False}]
    assert staff.post(f"/api/v1/matching/{match.id}/proof/", {"questions": wrong}, format="json").data["match"]["status"] == "proof_pending"
    right = [{"question": "What is under the lid?", "answer": "A red star sticker", "is_correct": True}]
    assert staff.post(f"/api/v1/matching/{match.id}/proof/", {"questions": right}, format="json").data["match"]["status"] == "verified"

    assert client_for(owner).post(f"/api/v1/matching/{match.id}/meeting-mode/", {"meeting_mode": "office"}, format="json").status_code == 200

    code = staff.post(f"/api/v1/matching/{match.id}/handover-code/generate/").data["code"]
    assert staff.post(f"/api/v1/matching/{match.id}/handover-code/verify/", {"code": "WRONG1"}, format="json").status_code == 400
    assert staff.post(f"/api/v1/matching/{match.id}/handover-code/verify/", {"code": code.lower()}, format="json").status_code == 200
    assert staff.post(f"/api/v1/matching/{match.id}/handover-code/verify/", {"code": code}, format="json").status_code == 400

    assert staff.post(f"/api/v1/matching/{match.id}/close/", {"reward_amount_settled": "100.00"}, format="json").status_code == 200
    match.refresh_from_db()
    assert match.status == Match.Status.CLOSED
    assert set(Post.objects.filter(pk__in=[lost_id, found_id]).values_list("status", flat=True)) == {Post.Status.RETURNED}

    # Each step told the people involved, and the handover code was never sent to anyone
    assert {"post_approved", "match_found", "handover_ready", "reward_recorded"} <= kinds(owner)
    assert {"post_approved", "match_found", "reward_recorded"} <= kinds(finder)
    assert not Notification.objects.filter(body__contains=code).exists()
    # Returned items leave the public feed
    feed_ids = {p["id"] for p in APIClient().get("/api/v1/posts/feed/?include_pending=false").data["data"]}
    assert not {lost_id, found_id} & feed_ids
