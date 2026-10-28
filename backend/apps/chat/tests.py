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
from apps.matching.models import Match
from apps.notifications.models import Notification
from apps.posts.models import Category, Post


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


@pytest.fixture
def outsider_user(db):
    user = User.objects.create_user(
        email="chat_outsider@iitrpr.ac.in",
        password="ValidPassword@123",
        full_name="Chirag Outsider",
        registration_number="2024CSM1063",
    )
    user.is_email_verified = True
    user.save()
    return user


@pytest.fixture
def match_case(owner_user, finder_user):
    """A match between owner_user's lost post and finder_user's found post."""
    category, _ = Category.objects.get_or_create(
        name="Wallet", defaults={"slug": "wallet", "icon": "wallet", "is_sensitive": True}
    )
    now = timezone.now()
    lost = Post.objects.create(
        author=owner_user,
        post_type=Post.PostType.LOST,
        category=category,
        title="Brown leather wallet",
        description="Brown wallet with my hostel ID inside",
        last_seen_place="Mess hall",
        last_seen_time=now - timedelta(days=1),
        status=Post.Status.APPROVED,
    )
    found = Post.objects.create(
        author=finder_user,
        post_type=Post.PostType.FOUND,
        category=category,
        title="Found brown wallet",
        description="Brown leather wallet near the mess",
        last_seen_place="Mess hall",
        last_seen_time=now,
        status=Post.Status.APPROVED,
    )
    return Match.objects.create(lost_post=lost, found_post=found, score=0.9)


@pytest.mark.django_db
class TestConversationCreateAccess:
    """POST /api/v1/chat/conversations/ only hands out threads the caller belongs in."""

    url = "/api/v1/chat/conversations/"

    def test_owner_gets_or_creates_owner_admin_thread(self, api_client, owner_user, match_case):
        api_client.force_authenticate(user=owner_user)
        first = api_client.post(self.url, {"match_id": str(match_case.id)}, format="json")
        assert first.status_code == status.HTTP_201_CREATED

        again = api_client.post(self.url, {"match_id": str(match_case.id)}, format="json")
        assert again.status_code == status.HTTP_200_OK
        assert again.data["data"]["id"] == first.data["data"]["id"]

    def test_finder_cannot_open_owner_admin_thread(self, api_client, owner_user, finder_user, match_case):
        conv = Conversation.objects.create(
            match=match_case, conversation_type=Conversation.ConversationType.OWNER_ADMIN
        )
        conv.participants.add(owner_user)
        Message.objects.create(conversation=conv, sender=owner_user, content="My hostel ID is in it")

        api_client.force_authenticate(user=finder_user)
        res = api_client.post(
            self.url,
            {"match_id": str(match_case.id), "conversation_type": "owner_admin"},
            format="json",
        )
        assert res.status_code == status.HTTP_403_FORBIDDEN
        assert "data" not in res.data
        assert not conv.participants.filter(pk=finder_user.pk).exists()

    def test_user_outside_the_match_is_refused(self, api_client, outsider_user, match_case):
        api_client.force_authenticate(user=outsider_user)
        for conv_type in ("owner_admin", "finder_admin", "direct"):
            res = api_client.post(
                self.url, {"match_id": str(match_case.id), "conversation_type": conv_type}, format="json"
            )
            assert res.status_code == status.HTTP_403_FORBIDDEN
        assert not Conversation.objects.exists()

    def test_admin_can_join_existing_thread(self, api_client, owner_user, admin_user, match_case):
        conv = Conversation.objects.create(
            match=match_case, conversation_type=Conversation.ConversationType.OWNER_ADMIN
        )
        conv.participants.add(owner_user)

        api_client.force_authenticate(user=admin_user)
        res = api_client.post(self.url, {"match_id": str(match_case.id)}, format="json")
        assert res.status_code == status.HTTP_200_OK
        assert conv.participants.filter(pk=admin_user.pk).exists()

    def test_thread_without_match_is_not_shared_between_users(self, api_client, owner_user, outsider_user):
        api_client.force_authenticate(user=owner_user)
        mine = api_client.post(self.url, {}, format="json")
        assert mine.status_code == status.HTTP_201_CREATED
        Message.objects.create(conversation_id=mine.data["data"]["id"], sender=owner_user, content="private note")

        api_client.force_authenticate(user=outsider_user)
        theirs = api_client.post(self.url, {}, format="json")
        assert theirs.status_code == status.HTTP_201_CREATED
        assert theirs.data["data"]["id"] != mine.data["data"]["id"]
        assert theirs.data["data"]["last_message"] is None

    def test_unknown_conversation_type_is_rejected(self, api_client, owner_user, match_case):
        api_client.force_authenticate(user=owner_user)
        res = api_client.post(
            self.url, {"match_id": str(match_case.id), "conversation_type": "group"}, format="json"
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert not Conversation.objects.exists()
