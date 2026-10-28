"""
chat/tests.py — Automated tests for Phase 8: Messaging, offline sync, blocklist, and unread receipts.
"""

from datetime import timedelta
import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.chat.models import BlockedUser, Conversation, Message
from apps.notifications.models import Notification


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def owner_user(db):
    user = User.objects.create_user(
        email="chat_owner@iitrpr.ac.in",
        password="ValidPassword@123",
        full_name="Aman Owner",
        registration_number="2024CSM1061",
    )
    user.is_email_verified = True
    user.save()
    return user


@pytest.fixture
def finder_user(db):
    user = User.objects.create_user(
        email="chat_finder@iitrpr.ac.in",
        password="ValidPassword@123",
        full_name="Bhavna Finder",
        registration_number="2024CSM1062",
    )
    user.is_email_verified = True
    user.save()
    return user


@pytest.fixture
def admin_user(db):
    user = User.objects.create_user(
        email="chat_admin@iitrpr.ac.in",
        password="AdminPassword@123",
        full_name="Admin Moderator",
        registration_number="2020ADM0005",
        is_staff=True,
    )
    user.is_email_verified = True
    user.is_campus_admin = True
    user.save()
    return user


@pytest.mark.django_db
class TestPhase8MessagingAndRealtimeChat:
    """
    Test suite for Phase 8:
    Admin mediation, direct chat approval, offline sync (?since cursor),
    blocked user barrier, and unread counts.
    """

    def test_admin_mediated_chat_exchange_and_notifications(
        self, api_client, owner_user, admin_user
    ):
        """Owner and admin exchange messages in an admin-mediated thread; unread recipient gets notification."""
        conv = Conversation.objects.create(
            conversation_type=Conversation.ConversationType.OWNER_ADMIN,
        )
        conv.participants.add(owner_user, admin_user)

        # 1. Owner sends message to admin
        api_client.force_authenticate(user=owner_user)
        res_send = api_client.post(
            f"/api/v1/chat/conversations/{conv.id}/messages/",
            {"content": "Hello Admin, is there any update on my lost laptop?"},
        )
        assert res_send.status_code == status.HTTP_201_CREATED
        assert res_send.data["data"]["content"] == "Hello Admin, is there any update on my lost laptop?"

        # Verify offline notification generated for admin
        notif = Notification.objects.filter(recipient=admin_user).first()
        assert notif is not None
        assert "Aman Owner" in notif.title

        # 2. Admin replies to owner
        api_client.force_authenticate(user=admin_user)
        res_reply = api_client.post(
            f"/api/v1/chat/conversations/{conv.id}/messages/",
            {"content": "Yes, we received a candidate match. Please check the portal."},
        )
        assert res_reply.status_code == status.HTTP_201_CREATED

        # Verify owner has unread message
        api_client.force_authenticate(user=owner_user)
        res_list = api_client.get(f"/api/v1/chat/conversations/{conv.id}/messages/")
        assert res_list.status_code == status.HTTP_200_OK
        assert len(res_list.data["data"]) == 2

    def test_direct_chat_requires_admin_approval(
        self, api_client, owner_user, finder_user, admin_user
    ):
        """Direct owner ↔ finder communication is blocked until campus admin explicitly approves it."""
        conv = Conversation.objects.create(
            conversation_type=Conversation.ConversationType.DIRECT,
            is_direct_approved=False,
        )
        conv.participants.add(owner_user, finder_user)

        # 1. Owner attempts to message finder directly before approval -> FORBIDDEN
        api_client.force_authenticate(user=owner_user)
        res_blocked = api_client.post(
            f"/api/v1/chat/conversations/{conv.id}/messages/",
            {"content": "Hi, I believe you found my item!"},
        )
        assert res_blocked.status_code == status.HTTP_403_FORBIDDEN
        err_msg = res_blocked.data.get("message") or res_blocked.data.get("detail", "")
        assert "requires admin approval" in err_msg

        # 2. Admin approves direct chat
        api_client.force_authenticate(user=admin_user)
        res_approve = api_client.post(f"/api/v1/chat/conversations/{conv.id}/approve-direct/")
        assert res_approve.status_code == status.HTTP_200_OK
        conv.refresh_from_db()
        assert conv.is_direct_approved is True

        # 3. Now owner can message finder directly
        api_client.force_authenticate(user=owner_user)
        res_allowed = api_client.post(
            f"/api/v1/chat/conversations/{conv.id}/messages/",
            {"content": "Hi, I believe you found my item!"},
        )
        assert res_allowed.status_code == status.HTTP_201_CREATED

    def test_offline_sync_using_since_cursor(self, api_client, owner_user, admin_user):
        """An offline user syncs new messages upon returning using the ?since= timestamp cursor."""
        conv = Conversation.objects.create(
            conversation_type=Conversation.ConversationType.OWNER_ADMIN,
        )
        conv.participants.add(owner_user, admin_user)

        t0 = timezone.now() - timedelta(minutes=10)

        # Message 1 (sent earlier)
        msg1 = Message.objects.create(conversation=conv, sender=admin_user, content="Old message")
        Message.objects.filter(id=msg1.id).update(created_at=t0)

        cursor_time = timezone.now() - timedelta(minutes=5)

        # Message 2 (sent after cursor)
        msg2 = Message.objects.create(conversation=conv, sender=admin_user, content="New message after sync point")
        Message.objects.filter(id=msg2.id).update(created_at=timezone.now())

        # Offline user returns and syncs with since=cursor_time
        api_client.force_authenticate(user=owner_user)
        res_sync = api_client.get(
            f"/api/v1/chat/conversations/{conv.id}/messages/?since={cursor_time.isoformat()}"
        )
        assert res_sync.status_code == status.HTTP_200_OK
        messages = res_sync.data["data"]

        # Should only receive msg2, not msg1
        assert len(messages) == 1
        assert messages[0]["content"] == "New message after sync point"

    def test_blocked_user_cannot_send_messages(self, api_client, owner_user, finder_user):
        """When a user blocks another, the blocked user cannot send messages to them."""
        conv = Conversation.objects.create(
            conversation_type=Conversation.ConversationType.DIRECT,
            is_direct_approved=True,
        )
        conv.participants.add(owner_user, finder_user)

        # Owner blocks Finder
        BlockedUser.objects.create(blocker=owner_user, blocked=finder_user)

        # Finder attempts to message Owner -> FORBIDDEN
        api_client.force_authenticate(user=finder_user)
        res = api_client.post(
            f"/api/v1/chat/conversations/{conv.id}/messages/",
            {"content": "Why are you not replying?"},
        )
        assert res.status_code == status.HTTP_403_FORBIDDEN
        err_msg = res.data.get("message") or res.data.get("detail", "")
        assert "messaging is blocked" in err_msg

    def test_read_receipt_and_unread_count_update(
        self, api_client, owner_user, finder_user
    ):
        """Messages count as unread until reader calls mark-read endpoint."""
        conv = Conversation.objects.create(
            conversation_type=Conversation.ConversationType.DIRECT,
            is_direct_approved=True,
        )
        conv.participants.add(owner_user, finder_user)

        # Finder sends 2 messages
        Message.objects.create(conversation=conv, sender=finder_user, content="M1")
        Message.objects.create(conversation=conv, sender=finder_user, content="M2")

        # Owner checks conversation list: unread count is 2
        api_client.force_authenticate(user=owner_user)
        res_convs = api_client.get("/api/v1/chat/conversations/")
        assert res_convs.status_code == status.HTTP_200_OK
        owner_conv = next(c for c in res_convs.data["data"] if c["id"] == str(conv.id))
        assert owner_conv["unread_count"] == 2

        # Owner marks conversation as read
        res_read = api_client.post(f"/api/v1/chat/conversations/{conv.id}/read/")
        assert res_read.status_code == status.HTTP_200_OK
        assert res_read.data["marked_read_count"] == 2

        # Unread count is now 0
        res_convs_after = api_client.get("/api/v1/chat/conversations/")
        owner_conv_after = next(c for c in res_convs_after.data["data"] if c["id"] == str(conv.id))
        assert owner_conv_after["unread_count"] == 0

    def test_non_participant_cannot_mark_conversation_read(
        self, api_client, owner_user, finder_user, admin_user
    ):
        """Only participants (or admins) may mark a thread read; others get 403 and nothing changes."""
        conv = Conversation.objects.create(
            conversation_type=Conversation.ConversationType.OWNER_ADMIN,
        )
        conv.participants.add(owner_user, admin_user)
        Message.objects.create(conversation=conv, sender=admin_user, content="Is this your wallet?")

        # finder_user is not part of this owner <-> admin thread
        api_client.force_authenticate(user=finder_user)
        res = api_client.post(f"/api/v1/chat/conversations/{conv.id}/read/")
        assert res.status_code == status.HTTP_403_FORBIDDEN
        assert conv.messages.filter(is_read=False).count() == 1

        # The owner still sees it as unread and can mark it read themselves
        api_client.force_authenticate(user=owner_user)
        res_owner = api_client.post(f"/api/v1/chat/conversations/{conv.id}/read/")
        assert res_owner.status_code == status.HTTP_200_OK
        assert res_owner.data["marked_read_count"] == 1
