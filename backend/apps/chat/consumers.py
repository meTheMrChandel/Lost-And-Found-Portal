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
from django.db.models import Q

from apps.chat.models import BlockedUser, Conversation, Message
from apps.chat.services import conversation_group, message_event_payload

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

            # Check if direct chat approved and not blocked
            can_send, reason = await self._can_send_message()
            if not can_send:
                await self.send(text_data=json.dumps({"type": "error", "error": reason}))
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
    def _can_send_message(self) -> tuple[bool, str]:
        try:
            conv = Conversation.objects.get(id=self.conversation_id)
        except Conversation.DoesNotExist:
            return False, "Conversation not found."

        if conv.conversation_type == Conversation.ConversationType.DIRECT and not conv.is_direct_approved:
            return False, "Direct owner-finder chat requires campus admin approval."

        other_participants = conv.participants.exclude(id=self.user.id)
        for other in other_participants:
            blocked = BlockedUser.objects.filter(
                Q(blocker=self.user, blocked=other) | Q(blocker=other, blocked=self.user)
            ).exists()
            if blocked:
                return False, "Messaging is blocked between participants."

        return True, ""

    @database_sync_to_async
    def _save_message(self, content: str) -> dict:
        msg = Message.objects.create(
            conversation_id=self.conversation_id,
            sender=self.user,
            content=content,
        )
        return message_event_payload(msg)

    @database_sync_to_async
    def _mark_messages_read(self) -> int:
        return Message.objects.filter(
            conversation_id=self.conversation_id, is_read=False
        ).exclude(sender=self.user).update(is_read=True, read_at=timezone.now())
