"""
chat/test_websocket.py — Tests for the realtime chat WebSocket (ws/chat/<id>/).

Runs the full ASGI websocket stack against an in-memory channel layer, so Redis
is not needed.
"""

import pytest
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.models import User
from apps.chat.models import Conversation
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
