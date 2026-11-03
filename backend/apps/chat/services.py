"""
chat/services.py — Messaging rules and realtime payloads shared by the REST views
and the WebSocket consumer, so both ways of sending a message behave the same.
"""

from typing import Optional

from django.db.models import Q
from django.utils import timezone

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

    if conv.conversation_type == Conversation.ConversationType.STUDENT:
        if conv.request_status == Conversation.RequestStatus.DECLINED:
            return "This message request was declined."
        # A pending request carries one message; the sender waits for an answer before sending more.
        # The recipient may reply, which accepts the request.
        if (
            conv.request_status == Conversation.RequestStatus.PENDING
            and conv.requested_by_id == user.id
            and conv.messages.filter(sender=user).exists()
        ):
            return "Wait for them to accept your message request before sending more."

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
    conv = msg.conversation
    for recipient in conv.participants.exclude(id=sender.id):
        if conv.item_id and conv.item.owner_id == recipient.id:
            title = f'New message about your "{conv.item.name}"'
        elif conv.request_status == Conversation.RequestStatus.PENDING and conv.requested_by_id == sender.id:
            title = f"New message request from {sender.full_name} ({sender.registration_number})"
        else:
            title = f"New message from {sender.full_name}"
        create_notification(
            recipient=recipient,
            notif_type="chat_message",
            title=title,
            body=content[:100] + ("..." if len(content) > 100 else ""),
            data={"conversation_id": str(msg.conversation_id), "message_id": str(msg.id)},
            send_email_copy=False,
        )


def accept_request_on_reply(conv: Conversation, user) -> None:
    """The recipient replying to a pending message request accepts it."""
    if (
        conv.conversation_type == Conversation.ConversationType.STUDENT
        and conv.request_status == Conversation.RequestStatus.PENDING
        and conv.requested_by_id != user.id
    ):
        conv.request_status = Conversation.RequestStatus.ACCEPTED
        conv.responded_at = timezone.now()
        conv.save(update_fields=["request_status", "responded_at"])
