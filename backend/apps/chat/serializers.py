"""
chat/serializers.py — Serializers for conversations, messages, and blocked users.
"""

from rest_framework import serializers

from apps.accounts.models import User
from apps.chat.models import BlockedUser, Conversation, Message


class ChatParticipantSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "full_name", "email", "registration_number"]


class MessageSerializer(serializers.ModelSerializer):
    sender = ChatParticipantSerializer(read_only=True)
    sender_id = serializers.UUIDField(source="sender.id", read_only=True)
    is_me = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            "id",
            "conversation",
            "sender",
            "sender_id",
            "content",
            "is_read",
            "read_at",
            "is_me",
            "created_at",
        ]
        read_only_fields = ["id", "conversation", "sender", "is_read", "read_at", "created_at"]

    def get_is_me(self, obj: Message) -> bool:
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return obj.sender_id == request.user.id
        return False


class MessageCreateSerializer(serializers.Serializer):
    content = serializers.CharField(min_length=1, max_length=5000)


class ConversationSerializer(serializers.ModelSerializer):
    participants = ChatParticipantSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    item = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            "id",
            "conversation_type",
            "match",
            "participants",
            "is_direct_approved",
            "origin",
            "request_status",
            "requested_by",
            "item",
            "last_message",
            "unread_count",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_item(self, obj: Conversation):
        if obj.item_id is None:
            return None
        return {"id": str(obj.item_id), "name": obj.item.name, "owner_id": str(obj.item.owner_id)}

    def to_representation(self, obj: Conversation):
        data = super().to_representation(obj)
        request = self.context.get("request")
        # Students talking to each other see a name and registration number, not an email address
        if obj.conversation_type == Conversation.ConversationType.STUDENT and not (request and request.user.is_staff):
            for person in data["participants"]:
                person.pop("email", None)
        return data

    def get_last_message(self, obj: Conversation):
        last = obj.messages.order_by("-created_at").first()
        if last:
            return {
                "id": str(last.id),
                "content": last.content,
                "sender_id": str(last.sender_id) if last.sender_id else None,
                "created_at": last.created_at.isoformat(),
                "is_read": last.is_read,
            }
        return None

    def get_unread_count(self, obj: Conversation) -> int:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return 0
        return obj.messages.filter(is_read=False).exclude(sender=request.user).count()


class BlockedUserSerializer(serializers.ModelSerializer):
    blocked = ChatParticipantSerializer(read_only=True)

    class Meta:
        model = BlockedUser
        fields = ["id", "blocked", "created_at"]
