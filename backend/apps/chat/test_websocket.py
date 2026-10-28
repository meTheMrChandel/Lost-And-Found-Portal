"""
chat/test_websocket.py — Tests for the realtime chat WebSocket (ws/chat/<id>/).

Runs the full ASGI websocket stack against an in-memory channel layer, so Redis
is not needed.
"""

import pytest
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.models import User
from apps.chat.models import BlockedUser, Conversation, Message
from apps.notifications.models import Notification
from config.asgi import application


@pytest.fixture(autouse=True)
def in_memory_channel_layer(settings):
    settings.CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}


def make_user(email, registration_number, **extra):
    user = User.objects.create_user(
        email=email,
        password="ValidPassword@123",
        full_name=email.split("@")[0].replace("_", " ").title(),
        registration_number=registration_number,
        **extra,
    )
    user.is_email_verified = True
    user.save()
    return user


@pytest.fixture
def owner_user(transactional_db):
    return make_user("ws_owner@iitrpr.ac.in", "2024CSM1071")


@pytest.fixture
def admin_user(transactional_db):
    return make_user("ws_admin@iitrpr.ac.in", "2020ADM0007", is_staff=True)


@pytest.fixture
def outsider_user(transactional_db):
    return make_user("ws_outsider@iitrpr.ac.in", "2024CSM1073")


@pytest.fixture
def conversation(owner_user, admin_user):
    conv = Conversation.objects.create(conversation_type=Conversation.ConversationType.OWNER_ADMIN)
    conv.participants.add(owner_user, admin_user)
    return conv


def communicator_for(conversation, user=None, token=None):
    path = f"/ws/chat/{conversation.id}/"
    if token is None and user is not None:
        token = str(AccessToken.for_user(user))
    if token is not None:
        path += f"?token={token}"
    return WebsocketCommunicator(application, path, headers=[(b"origin", b"http://localhost")])


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
class TestChatWebSocketAuth:
    async def test_participant_with_valid_token_connects(self, conversation, owner_user):
        communicator = communicator_for(conversation, owner_user)
        connected, _ = await communicator.connect()
        assert connected
        await communicator.disconnect()

    async def test_missing_token_is_rejected(self, conversation):
        communicator = communicator_for(conversation)
        connected, close_code = await communicator.connect()
        assert not connected
        assert close_code == 4401
        await communicator.disconnect()

    async def test_invalid_token_is_rejected(self, conversation):
        communicator = communicator_for(conversation, token="not-a-real-jwt")
        connected, close_code = await communicator.connect()
        assert not connected
        assert close_code == 4401
        await communicator.disconnect()

    async def test_token_of_inactive_user_is_rejected(self, conversation, owner_user):
        token = str(AccessToken.for_user(owner_user))
        owner_user.is_active = False
        await database_sync_to_async(owner_user.save)()

        communicator = communicator_for(conversation, token=token)
        connected, close_code = await communicator.connect()
        assert not connected
        assert close_code == 4401
        await communicator.disconnect()

    async def test_non_participant_is_rejected(self, conversation, outsider_user):
        communicator = communicator_for(conversation, outsider_user)
        connected, close_code = await communicator.connect()
        assert not connected
        assert close_code == 4403
        await communicator.disconnect()

    async def test_banned_user_is_rejected(self, conversation, owner_user):
        owner_user.is_banned = True
        await database_sync_to_async(owner_user.save)()

        communicator = communicator_for(conversation, owner_user)
        connected, close_code = await communicator.connect()
        assert not connected
        assert close_code == 4403
        await communicator.disconnect()

    async def test_staff_can_join_any_conversation(self, transactional_db, owner_user):
        staff = await database_sync_to_async(make_user)(
            "ws_staff@iitrpr.ac.in", "2020ADM0008", is_staff=True
        )
        conv = await database_sync_to_async(Conversation.objects.create)(
            conversation_type=Conversation.ConversationType.OWNER_ADMIN
        )
        await database_sync_to_async(conv.participants.add)(owner_user)

        communicator = communicator_for(conv, staff)
        connected, _ = await communicator.connect()
        assert connected
        await communicator.disconnect()


async def connected_communicator(conversation, user):
    communicator = communicator_for(conversation, user)
    connected, _ = await communicator.connect()
    assert connected
    return communicator


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
class TestChatWebSocketMessaging:
    async def test_sent_message_is_saved_and_broadcast_to_all_participants(
        self, conversation, owner_user, admin_user
    ):
        owner_ws = await connected_communicator(conversation, owner_user)
        admin_ws = await connected_communicator(conversation, admin_user)

        # Same frame the web client sends
        await owner_ws.send_json_to({"action": "send_message", "content": "  Lost my blue bottle  "})

        for ws in (owner_ws, admin_ws):
            frame = await ws.receive_json_from()
            assert frame["type"] == "chat_message"
            assert frame["message"]["content"] == "Lost my blue bottle"
            assert frame["message"]["sender_id"] == str(owner_user.id)
            assert frame["message"]["sender_name"] == owner_user.full_name

        saved = await database_sync_to_async(
            lambda: list(Message.objects.filter(conversation=conversation).values_list("content", flat=True))
        )()
        assert saved == ["Lost my blue bottle"]

        await owner_ws.disconnect()
        await admin_ws.disconnect()

    async def test_legacy_type_field_still_sends(self, conversation, owner_user):
        ws = await connected_communicator(conversation, owner_user)
        await ws.send_json_to({"type": "message", "content": "hello"})
        frame = await ws.receive_json_from()
        assert frame["type"] == "chat_message"
        assert frame["message"]["content"] == "hello"
        await ws.disconnect()

    async def test_blank_or_malformed_frames_are_ignored(self, conversation, owner_user):
        ws = await connected_communicator(conversation, owner_user)
        await ws.send_json_to({"action": "send_message", "content": "   "})
        await ws.send_to(text_data="not json")
        await ws.send_to(text_data="[1, 2, 3]")
        assert await ws.receive_nothing()
        assert not await database_sync_to_async(Message.objects.exists)()
        await ws.disconnect()

    async def test_message_sent_over_rest_reaches_open_sockets(self, conversation, owner_user, admin_user):
        owner_ws = await connected_communicator(conversation, owner_user)

        def post_as_admin():
            client = APIClient()
            client.force_authenticate(user=admin_user)
            return client.post(
                f"/api/v1/chat/conversations/{conversation.id}/messages/",
                {"content": "Please bring your ID to the security office."},
                format="json",
            )

        res = await database_sync_to_async(post_as_admin)()
        assert res.status_code == 201

        frame = await owner_ws.receive_json_from()
        assert frame["type"] == "chat_message"
        assert frame["message"]["sender_id"] == str(admin_user.id)
        assert frame["message"]["sender_name"] == admin_user.full_name
        assert "is_me" not in frame["message"]
        await owner_ws.disconnect()

    async def test_mark_read_updates_messages_and_sends_receipt(self, conversation, owner_user, admin_user):
        await database_sync_to_async(Message.objects.create)(
            conversation=conversation, sender=admin_user, content="Is this your wallet?"
        )
        owner_ws = await connected_communicator(conversation, owner_user)
        admin_ws = await connected_communicator(conversation, admin_user)

        await owner_ws.send_json_to({"action": "mark_read"})

        frame = await admin_ws.receive_json_from()
        assert frame["type"] == "read_receipt"
        assert frame["reader_id"] == str(owner_user.id)
        assert not await database_sync_to_async(Message.objects.filter(is_read=False).exists)()

        await owner_ws.disconnect()
        await admin_ws.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
class TestChatWebSocketSendRules:
    """Sending over the socket follows the same rules as POST .../messages/."""

    async def test_recipients_get_an_in_app_notification(self, conversation, owner_user, admin_user):
        ws = await connected_communicator(conversation, owner_user)
        await ws.send_json_to({"action": "send_message", "content": "Found it near the library"})
        await ws.receive_json_from()

        notified = await database_sync_to_async(
            lambda: list(Notification.objects.filter(notif_type="chat_message").values_list("recipient_id", flat=True))
        )()
        assert notified == [admin_user.id]
        await ws.disconnect()

    async def test_message_over_length_limit_is_refused(self, conversation, owner_user):
        ws = await connected_communicator(conversation, owner_user)
        await ws.send_json_to({"action": "send_message", "content": "x" * 5001})

        frame = await ws.receive_json_from()
        assert frame["type"] == "error"
        assert not await database_sync_to_async(Message.objects.exists)()
        await ws.disconnect()

    async def test_unapproved_direct_chat_is_refused(self, transactional_db, owner_user, outsider_user):
        def make_direct():
            conv = Conversation.objects.create(conversation_type=Conversation.ConversationType.DIRECT)
            conv.participants.add(owner_user, outsider_user)
            return conv

        conv = await database_sync_to_async(make_direct)()
        ws = await connected_communicator(conv, owner_user)
        await ws.send_json_to({"action": "send_message", "content": "Can we meet?"})

        frame = await ws.receive_json_from()
        assert frame["type"] == "error"
        assert "requires admin approval" in frame["error"]
        assert not await database_sync_to_async(Message.objects.exists)()
        await ws.disconnect()

    async def test_blocked_participant_cannot_send(self, conversation, owner_user, admin_user):
        await database_sync_to_async(BlockedUser.objects.create)(blocker=admin_user, blocked=owner_user)

        ws = await connected_communicator(conversation, owner_user)
        await ws.send_json_to({"action": "send_message", "content": "hello?"})

        frame = await ws.receive_json_from()
        assert frame["type"] == "error"
        assert "blocked" in frame["error"]
        assert not await database_sync_to_async(Message.objects.exists)()
        await ws.disconnect()
