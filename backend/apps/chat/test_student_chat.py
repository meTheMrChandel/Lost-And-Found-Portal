"""
chat/test_student_chat.py — Student ↔ student chat: a registration number search starts a
message request the recipient must accept; a QR sticker scan opens a chat straight away.
"""

from datetime import timedelta

import pytest
from django.core.cache import cache
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.chat.models import BlockedUser, Conversation
from apps.items.models import RegisteredItem
from apps.notifications.models import Notification
from apps.posts.models import Category


def make_user(email, reg, **extra):
    return User.objects.create_user(email=email, registration_number=reg, password="TestPassword123", full_name=email.split(".")[0].title(), **extra)


def api(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def people(db):
    cache.clear()  # throttle counters
    asha = make_user("asha.chat@iitrpr.ac.in", "2024CSM1800")
    ravi = make_user("ravi.chat@iitrpr.ac.in", "2024CSM1801")
    return asha, ravi


def request_chat(sender, reg, message="Hi, did you lose a blue bottle near the library?"):
    return api(sender).post("/api/v1/chat/requests/", {"registration_number": reg, "message": message}, format="json")


def send(user, conv_id, content):
    return api(user).post(f"/api/v1/chat/conversations/{conv_id}/messages/", {"content": content}, format="json")


@pytest.mark.django_db
class TestLookup:
    def test_exact_number_returns_only_name_and_number(self, people):
        asha, ravi = people
        res = api(asha).get("/api/v1/chat/students/lookup/", {"registration_number": "2024csm1801"})
        assert res.status_code == 200
        assert res.data["data"] == {"id": str(ravi.id), "full_name": ravi.full_name, "registration_number": "2024CSM1801", "existing_conversation_id": None}

    def test_partial_numbers_and_self_are_refused(self, people):
        asha, ravi = people
        assert api(asha).get("/api/v1/chat/students/lookup/", {"registration_number": "2024CSM18"}).status_code == 404
        assert api(asha).get("/api/v1/chat/students/lookup/", {"registration_number": "2024CSM1800"}).status_code == 400

    def test_banned_students_cannot_be_found(self, people):
        asha, ravi = people
        User.objects.filter(pk=ravi.pk).update(is_banned=True)
        assert api(asha).get("/api/v1/chat/students/lookup/", {"registration_number": "2024CSM1801"}).status_code == 404

    def test_anonymous_cannot_look_up(self, people):
        assert APIClient().get("/api/v1/chat/students/lookup/", {"registration_number": "2024CSM1801"}).status_code == 401


@pytest.mark.django_db
class TestMessageRequests:
    def test_request_carries_one_message_until_accepted(self, people):
        asha, ravi = people
        res = request_chat(asha, "2024CSM1801")
        assert res.status_code == 201
        conv = res.data["data"]
        assert conv["request_status"] == "pending" and conv["origin"] == "registration_search"
        # No email addresses between students
        assert all("email" not in p for p in conv["participants"])

        note = Notification.objects.get(recipient=ravi)
        assert note.title == f"New message request from {asha.full_name} (2024CSM1800)"

        res = send(asha, conv["id"], "Hello again?")
        assert res.status_code == 403 and "accept" in str(res.data)

    def test_recipient_replying_accepts_the_request(self, people):
        asha, ravi = people
        conv_id = request_chat(asha, "2024CSM1801").data["data"]["id"]
        assert send(ravi, conv_id, "Yes, that's mine!").status_code == 201
        assert Conversation.objects.get(pk=conv_id).request_status == Conversation.RequestStatus.ACCEPTED
        assert send(asha, conv_id, "Great, it's at the security office").status_code == 201

    def test_accept_and_decline(self, people):
        asha, ravi = people
        conv_id = request_chat(asha, "2024CSM1801").data["data"]["id"]
        # The sender can't answer their own request
        assert api(asha).post(f"/api/v1/chat/requests/{conv_id}/respond/", {"action": "accept"}).status_code == 403

        res = api(ravi).post(f"/api/v1/chat/requests/{conv_id}/respond/", {"action": "decline"})
        assert res.status_code == 200 and res.data["data"]["request_status"] == "declined"
        assert send(asha, conv_id, "Please?").status_code == 403
        assert send(ravi, conv_id, "Changed my mind").status_code == 403

    def test_declined_requester_waits_thirty_days(self, people):
        asha, ravi = people
        conv_id = request_chat(asha, "2024CSM1801").data["data"]["id"]
        api(ravi).post(f"/api/v1/chat/requests/{conv_id}/respond/", {"action": "decline"})
        assert request_chat(asha, "2024CSM1801").status_code == 403

        Conversation.objects.filter(pk=conv_id).update(responded_at=timezone.now() - timedelta(days=31))
        res = request_chat(asha, "2024CSM1801")
        assert res.status_code == 201 and res.data["data"]["id"] != conv_id

    def test_existing_conversation_is_reused(self, people):
        asha, ravi = people
        first = request_chat(asha, "2024CSM1801").data["data"]["id"]
        again = request_chat(asha, "2024CSM1801")
        assert again.status_code == 200 and again.data["data"]["id"] == first
        # Ravi messaging Asha back by number lands in the same thread
        assert request_chat(ravi, "2024CSM1800").data["data"]["id"] == first
        assert Conversation.objects.count() == 1
        lookup = api(asha).get("/api/v1/chat/students/lookup/", {"registration_number": "2024CSM1801"})
        assert lookup.data["data"]["existing_conversation_id"] == first

    def test_blocking_either_way_stops_requests(self, people):
        asha, ravi = people
        BlockedUser.objects.create(blocker=ravi, blocked=asha)
        assert request_chat(asha, "2024CSM1801").status_code == 403
        assert request_chat(ravi, "2024CSM1800").status_code == 403

    def test_at_most_five_new_requests_a_day(self, people):
        asha, _ = people
        for n in range(5):
            make_user(f"s{n}.chat@iitrpr.ac.in", f"2024CSM19{n:02d}")
            assert request_chat(asha, f"2024CSM19{n:02d}").status_code == 201
        make_user("s9.chat@iitrpr.ac.in", "2024CSM1999")
        res = request_chat(asha, "2024CSM1999")
        assert res.status_code == 429 and "5 new message requests" in str(res.data)

    def test_cannot_message_yourself_or_send_empty(self, people):
        asha, _ = people
        assert request_chat(asha, "2024CSM1800").status_code == 400
        assert request_chat(asha, "2024CSM1801", message="").status_code == 400
        assert not Conversation.objects.exists()


@pytest.mark.django_db
class TestQRChat:
    @pytest.fixture
    def bike(self, people):
        call_command("seed_data")
        asha, _ = people
        return RegisteredItem.objects.create(owner=asha, name="Hero Sprint bicycle", category=Category.objects.get(slug="bicycle"))

    def test_signed_in_scanner_sees_the_registration_number(self, people, bike):
        asha, ravi = people
        data = api(ravi).get(f"/api/v1/items/scan/{bike.qr_uuid}/").data["data"]
        assert data["owner_registration_number"] == "2024CSM1800" and data["can_chat"] is True
        anonymous = APIClient().get(f"/api/v1/items/scan/{bike.qr_uuid}/").data["data"]
        assert "owner_registration_number" not in anonymous and anonymous["can_chat"] is False
        own = api(asha).get(f"/api/v1/items/scan/{bike.qr_uuid}/").data["data"]
        assert own["is_owner"] is True and own["can_chat"] is False

    def test_scan_chat_opens_straight_away_and_names_the_item(self, people, bike):
        asha, ravi = people
        res = api(ravi).post("/api/v1/chat/qr/", {"qr_uuid": str(bike.qr_uuid), "message": "I have your cycle"}, format="json")
        assert res.status_code == 201
        conv = res.data["data"]
        assert conv["request_status"] == "accepted" and conv["origin"] == "qr_scan"
        assert conv["item"]["name"] == "Hero Sprint bicycle"
        assert Notification.objects.get(recipient=asha).title == 'New message about your "Hero Sprint bicycle"'
        assert send(ravi, conv["id"], "It's at the gym").status_code == 201

        again = api(ravi).post("/api/v1/chat/qr/", {"qr_uuid": str(bike.qr_uuid)}, format="json")
        assert again.status_code == 200 and again.data["data"]["id"] == conv["id"]

    def test_owner_deactivated_and_blocked_are_refused(self, people, bike):
        asha, ravi = people
        assert api(asha).post("/api/v1/chat/qr/", {"qr_uuid": str(bike.qr_uuid)}).status_code == 400
        BlockedUser.objects.create(blocker=asha, blocked=ravi)
        assert api(ravi).post("/api/v1/chat/qr/", {"qr_uuid": str(bike.qr_uuid)}).status_code == 403
        RegisteredItem.objects.filter(pk=bike.pk).update(is_active=False)
        assert api(ravi).post("/api/v1/chat/qr/", {"qr_uuid": str(bike.qr_uuid)}).status_code == 400
        assert APIClient().post("/api/v1/chat/qr/", {"qr_uuid": str(bike.qr_uuid)}).status_code == 401
