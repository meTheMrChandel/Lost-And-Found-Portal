"""
chat/services.py — Realtime event payloads shared by the REST views and the WebSocket consumer.
"""

from apps.chat.models import Message


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
