"""
chat/views.py — REST endpoints for conversations, messages, offline sync, and user blocking.
"""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.permissions import IsCampusAdmin, IsNotBanned
from apps.chat.models import BlockedUser, Conversation, Message
from apps.chat.serializers import (
    BlockedUserSerializer,
    ConversationSerializer,
    MessageCreateSerializer,
    MessageSerializer,
)
from apps.chat.services import (
    conversation_group,
    message_event_payload,
    notify_recipients,
    send_block_reason,
)
from apps.matching.models import Match


def get_conversation_for_user(pk, user) -> Conversation:
    """The conversation, if `user` is a participant or an admin; 404/403 otherwise."""
    conv = get_object_or_404(Conversation, pk=pk)
    is_admin = user.is_staff or getattr(user, "is_campus_admin", False)
    if not is_admin and not conv.participants.filter(pk=user.pk).exists():
        raise PermissionDenied("You are not a participant in this conversation.")
    return conv


class ConversationListCreateView(APIView):
    """
    GET /api/v1/chat/conversations/
      List all conversations for the authenticated user.
    POST /api/v1/chat/conversations/
      Get or create an admin-mediated conversation for a match case.
    """
    permission_classes = [IsAuthenticated, IsNotBanned]

    def get(self, request):
        user = request.user
        if user.is_staff or getattr(user, "is_campus_admin", False):
            # Staff can see all conversations
            qs = Conversation.objects.all()
        else:
            qs = Conversation.objects.filter(participants=user)

        qs = qs.prefetch_related("participants", "messages").order_by("-created_at")
        serializer = ConversationSerializer(qs, many=True, context={"request": request})
        return Response({"success": True, "data": serializer.data}, status=status.HTTP_200_OK)

    def post(self, request):
        match_id = request.data.get("match_id")
        conv_type = request.data.get("conversation_type", Conversation.ConversationType.OWNER_ADMIN)
        match = get_object_or_404(Match, pk=match_id) if match_id else None

        user = request.user
        is_admin = user.is_staff or getattr(user, "is_campus_admin", False)

        # Check existing conversation
        existing = Conversation.objects.filter(match=match, conversation_type=conv_type).first()
        if existing:
            # If not yet a participant, add them if authorized
            if user not in existing.participants.all() and (is_admin or user.id in [match.lost_post.author_id, match.found_post.author_id]):
                existing.participants.add(user)
            return Response(
                {"success": True, "data": ConversationSerializer(existing, context={"request": request}).data},
                status=status.HTTP_200_OK,
            )

        # Direct owner-finder chat requires admin approval
        is_direct_approved = False
        if conv_type == Conversation.ConversationType.DIRECT:
            if not is_admin:
                raise PermissionDenied("Direct owner ↔ finder chat can only be initiated or approved by campus administrators.")
            is_direct_approved = True

        conv = Conversation.objects.create(
            match=match,
            conversation_type=conv_type,
            is_direct_approved=is_direct_approved,
        )

        # Add participants based on type
        if match:
            if conv_type == Conversation.ConversationType.OWNER_ADMIN:
                conv.participants.add(match.lost_post.author)
                if match.assigned_to:
                    conv.participants.add(match.assigned_to)
                if user.is_staff:
                    conv.participants.add(user)
            elif conv_type == Conversation.ConversationType.FINDER_ADMIN:
                conv.participants.add(match.found_post.author)
                if match.assigned_to:
                    conv.participants.add(match.assigned_to)
                if user.is_staff:
                    conv.participants.add(user)
            elif conv_type == Conversation.ConversationType.DIRECT:
                conv.participants.add(match.lost_post.author)
                conv.participants.add(match.found_post.author)
                if is_admin:
                    conv.participants.add(user)
        else:
            conv.participants.add(user)

        return Response(
            {"success": True, "data": ConversationSerializer(conv, context={"request": request}).data},
            status=status.HTTP_201_CREATED,
        )


class ConversationDetailView(generics.RetrieveAPIView):
    """
    GET /api/v1/chat/conversations/<pk>/
    Retrieve conversation metadata and participants.
    """
    permission_classes = [IsAuthenticated, IsNotBanned]
    serializer_class = ConversationSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or getattr(user, "is_campus_admin", False):
            return Conversation.objects.all().prefetch_related("participants")
        return Conversation.objects.filter(participants=user).prefetch_related("participants")


class ConversationMessagesListView(APIView):
    """
    GET /api/v1/chat/conversations/<pk>/messages/?since=<timestamp>
      List messages in thread with ?since cursor for offline synchronization.
    POST /api/v1/chat/conversations/<pk>/messages/
      Send a message. Validates blocklist and direct approval.
    """
    permission_classes = [IsAuthenticated, IsNotBanned]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "chat_message"

    def get(self, request, pk):
        user = request.user
        conv = get_conversation_for_user(pk, user)

        qs = conv.messages.select_related("sender").order_by("created_at")

        # Offline sync using ?since= ISO timestamp cursor
        since_param = request.query_params.get("since")
        if since_param:
            # Clean up potential space-replaced plus signs from URL query decoding
            if " " in since_param and "+" not in since_param:
                parts = since_param.rsplit(" ", 1)
                if len(parts) == 2 and ":" in parts[1]:
                    since_param = "+".join(parts)
            since_dt = parse_datetime(since_param)
            if since_dt:
                qs = qs.filter(created_at__gt=since_dt)

        serializer = MessageSerializer(qs, many=True, context={"request": request})
        return Response(
            {
                "success": True,
                "count": qs.count(),
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request, pk):
        user = request.user
        conv = get_conversation_for_user(pk, user)
        serializer = MessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Direct chat needs admin approval, and no participant may have blocked another
        reason = send_block_reason(conv, user)
        if reason:
            raise PermissionDenied(reason)

        content = serializer.validated_data["content"]
        msg = Message.objects.create(
            conversation=conv,
            sender=user,
            content=content,
        )

        msg_data = MessageSerializer(msg, context={"request": request}).data

        # Broadcast via Django Channels to WebSocket group. Use the shared socket payload
        # rather than msg_data, whose is_me is relative to the sender.
        try:
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    conversation_group(conv.id),
                    {
                        "type": "chat.message",
                        "message": message_event_payload(msg),
                    },
                )
        except Exception:
            pass

        # Dispatch in-app notification to offline participants
        notify_recipients(msg)

        return Response(
            {
                "success": True,
                "message": "Message sent successfully.",
                "data": msg_data,
            },
            status=status.HTTP_201_CREATED,
        )


class ConversationMarkReadView(APIView):
    """
    POST /api/v1/chat/conversations/<pk>/read/
    Marks unread messages in the thread as read.
    """
    permission_classes = [IsAuthenticated, IsNotBanned]

    def post(self, request, pk):
        user = request.user
        conv = get_conversation_for_user(pk, user)

        updated_count = conv.messages.filter(is_read=False).exclude(sender=user).update(
            is_read=True, read_at=timezone.now()
        )

        # Broadcast read receipt via Channels
        try:
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    conversation_group(conv.id),
                    {
                        "type": "chat.read_receipt",
                        "reader_id": str(user.id),
                        "read_at": timezone.now().isoformat(),
                    },
                )
        except Exception:
            pass

        return Response(
            {
                "success": True,
                "message": f"{updated_count} message(s) marked read.",
                "marked_read_count": updated_count,
            },
            status=status.HTTP_200_OK,
        )


class ConversationApproveDirectChatView(APIView):
    """
    POST /api/v1/chat/conversations/<pk>/approve-direct/
    Campus admin approval granting direct communication between owner and finder.
    """
    permission_classes = [IsCampusAdmin, IsNotBanned]

    def post(self, request, pk):
        conv = get_object_or_404(Conversation, pk=pk)
        conv.is_direct_approved = True
        conv.save(update_fields=["is_direct_approved"])

        return Response(
            {
                "success": True,
                "message": "Direct owner ↔ finder chat has been approved by admin.",
                "conversation": ConversationSerializer(conv, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )


class UserBlockToggleView(APIView):
    """
    POST /api/v1/chat/block/
    Body: {"user_id": <uuid>}
    Blocks or unblocks a specified user.
    """
    permission_classes = [IsAuthenticated, IsNotBanned]

    def post(self, request):
        target_id = request.data.get("user_id")
        target_user = get_object_or_404(User, pk=target_id)

        if target_user == request.user:
            return Response({"detail": "You cannot block yourself."}, status=status.HTTP_400_BAD_REQUEST)

        block_entry = BlockedUser.objects.filter(blocker=request.user, blocked=target_user).first()
        if block_entry:
            block_entry.delete()
            return Response(
                {"success": True, "message": f"{target_user.full_name} has been unblocked.", "is_blocked": False},
                status=status.HTTP_200_OK,
            )
        else:
            BlockedUser.objects.create(blocker=request.user, blocked=target_user)
            return Response(
                {"success": True, "message": f"{target_user.full_name} has been blocked.", "is_blocked": True},
                status=status.HTTP_200_OK,
            )


class BlockedUserListView(generics.ListAPIView):
    """
    GET /api/v1/chat/blocked/
    Lists users currently blocked by the authenticated user.
    """
    permission_classes = [IsAuthenticated, IsNotBanned]
    serializer_class = BlockedUserSerializer

    def get_queryset(self):
        return BlockedUser.objects.filter(blocker=self.request.user).select_related("blocked")
