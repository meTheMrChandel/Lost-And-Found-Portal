"""
chat/services.py — Messaging rules and realtime payloads shared by the REST views
and the WebSocket consumer, so both ways of sending a message behave the same.
"""

from typing import Optional

from django.db.models import Q

from apps.chat.models import BlockedUser, Conversation, Message
from apps.notifications.services import create_notification


def conversation_group(conversation_id) -> str:
    """Channels group that every socket joined to a conversation listens on."""
    return f"chat_{conversation_id}"


def message_event_payload(msg: Message) -> dict:
    """
    A message as broadcast to every socket in its conversation.

    Sockets of both the sender and the recipients get the same payload, so it
    carries nothing relative to one viewer (clients work out is_me from sender_id).
    """
    sender = msg.sender
    return {
        "id": str(msg.id),
        "conversation_id": str(msg.conversation_id),
        "sender_id": str(sender.id) if sender else None,
        "sender_name": (sender.full_name or sender.email) if sender else "",
        "content": msg.content,
        "is_read": msg.is_read,
        "created_at": msg.created_at.isoformat(),
    }


def send_block_reason(conv: Conversation, user) -> Optional[str]:
    """Why `user` may not post in `conv` right now, or None if they may."""
    if conv.conversation_type == Conversation.ConversationType.DIRECT and not conv.is_direct_approved:
        return "Direct chat between owner and finder requires admin approval before messaging."

    others = conv.participants.exclude(id=user.id)
    if BlockedUser.objects.filter(
        Q(blocker=user, blocked__in=others) | Q(blocker__in=others, blocked=user)
    ).exists():
        return "Cannot send message: messaging is blocked between users."

    return None


def notify_recipients(msg: Message) -> None:
    """In-app notification for every participant other than the sender."""
    sender = msg.sender
    content = msg.content
    for recipient in msg.conversation.participants.exclude(id=sender.id):
        create_notification(
            recipient=recipient,
            notif_type="chat_message",
            title=f"New message from {sender.full_name}",
            body=content[:100] + ("..." if len(content) > 100 else ""),
            data={"conversation_id": str(msg.conversation_id), "message_id": str(msg.id)},
            send_email_copy=False,
        )
