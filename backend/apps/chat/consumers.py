"""
chat/consumers.py — Django Channels WebSocket consumer for realtime chat & receipts.

Client → server frames:
    {"action": "send_message", "content": "..."}
    {"action": "mark_read"}
("type": "message" / "read" are accepted as older spellings of the same actions.)

Server → client frames:
    {"type": "chat_message", "message": {...}}
    {"type": "read_receipt", "reader_id": "...", "read_at": "..."}
    {"type": "error", "error": "..."}
"""

import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone

from apps.chat.models import Conversation, Message
from apps.chat.serializers import MessageCreateSerializer
from apps.chat.services import (
    conversation_group,
    message_event_payload,
    notify_recipients,
    send_block_reason,
)

SEND_ACTIONS = {"send_message", "message"}
READ_ACTIONS = {"mark_read", "read"}


class ChatConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for live messaging within a case conversation thread.
    Route: ws/chat/<uuid:conversation_id>/
    """

    async def connect(self):
        self.conversation_id = self.scope["url_route"]["kwargs"]["conversation_id"]
        self.room_group_name = conversation_group(self.conversation_id)
        self.user = self.scope.get("user")

        # Reject unauthenticated connections
        if not self.user or not self.user.is_authenticated:
            await self.close(code=4401)
            return

        # Banned users are locked out of chat, as on the REST endpoints (IsNotBanned)
        if getattr(self.user, "is_banned", False):
            await self.close(code=4403)
            return

        # Check authorization to join conversation
        is_allowed = await self._is_participant()
        if not is_allowed:
            await self.close(code=4403)
            return

        # Join room group
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        if hasattr(self, "room_group_name"):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        if not isinstance(data, dict):
            return

        action = data.get("action") or data.get("type") or "send_message"

        if action in SEND_ACTIONS:
            content = str(data.get("content", "")).strip()
            if not content:
                return

            # Same length limit as the REST endpoint
            serializer = MessageCreateSerializer(data={"content": content})
            if not serializer.is_valid():
                await self._send_error(serializer.errors["content"][0])
                return

            # Check if direct chat approved and not blocked
            reason = await self._send_block_reason()
            if reason:
                await self._send_error(reason)
                return

            # Save message to DB
            msg_data = await self._save_message(content)

            # Broadcast to group
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "chat.message",
                    "message": msg_data,
                },
            )

        elif action in READ_ACTIONS:
            # Mark messages read
            read_count = await self._mark_messages_read()
            if read_count > 0:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "chat.read_receipt",
                        "reader_id": str(self.user.id),
                        "read_at": timezone.now().isoformat(),
                    },
                )

    async def _send_error(self, reason):
        await self.send(text_data=json.dumps({"type": "error", "error": str(reason)}))

    async def chat_message(self, event):
        """Called when a message is broadcast to this group."""
        await self.send(text_data=json.dumps({
            "type": "chat_message",
            "message": event["message"],
        }))

    async def chat_read_receipt(self, event):
        """Called when a read receipt is broadcast to this group."""
        await self.send(text_data=json.dumps({
            "type": "read_receipt",
            "reader_id": event["reader_id"],
            "read_at": event["read_at"],
        }))

    @database_sync_to_async
    def _is_participant(self) -> bool:
        if self.user.is_staff or getattr(self.user, "is_campus_admin", False):
            return True
        return Conversation.objects.filter(
            id=self.conversation_id, participants=self.user
        ).exists()

    @database_sync_to_async
    def _send_block_reason(self):
        try:
            conv = Conversation.objects.get(id=self.conversation_id)
        except Conversation.DoesNotExist:
            return "Conversation not found."
        return send_block_reason(conv, self.user)

    @database_sync_to_async
    def _save_message(self, content: str) -> dict:
        msg = Message.objects.create(
            conversation_id=self.conversation_id,
            sender=self.user,
            content=content,
        )
        notify_recipients(msg)
        return message_event_payload(msg)

    @database_sync_to_async
    def _mark_messages_read(self) -> int:
        return Message.objects.filter(
            conversation_id=self.conversation_id, is_read=False
        ).exclude(sender=self.user).update(is_read=True, read_at=timezone.now())
