"""
chat/urls.py — REST routing for messaging, offline sync, and user blocking.
"""

from django.urls import path
from apps.chat.views import (
    BlockedUserListView,
    ConversationApproveDirectChatView,
    ConversationDetailView,
    ConversationListCreateView,
    ConversationMarkReadView,
    ConversationMessagesListView,
    MessageRequestRespondView,
    MessageRequestView,
    QRConversationView,
    StudentLookupView,
    UserBlockToggleView,
)

urlpatterns = [
    # Conversations
    path("conversations/", ConversationListCreateView.as_view(), name="conversations-list-create"),
    path("conversations/<uuid:pk>/", ConversationDetailView.as_view(), name="conversation-detail"),
    path("conversations/<uuid:pk>/messages/", ConversationMessagesListView.as_view(), name="conversation-messages"),
    path("conversations/<uuid:pk>/read/", ConversationMarkReadView.as_view(), name="conversation-mark-read"),
    path("conversations/<uuid:pk>/approve-direct/", ConversationApproveDirectChatView.as_view(), name="conversation-approve-direct"),

    # Student ↔ student: by registration number (a message request) or from a QR sticker
    path("students/lookup/", StudentLookupView.as_view(), name="chat-student-lookup"),
    path("requests/", MessageRequestView.as_view(), name="chat-message-request"),
    path("requests/<uuid:pk>/respond/", MessageRequestRespondView.as_view(), name="chat-message-request-respond"),
    path("qr/", QRConversationView.as_view(), name="chat-qr-conversation"),

    # Block list
    path("block/", UserBlockToggleView.as_view(), name="chat-user-block-toggle"),
    path("blocked/", BlockedUserListView.as_view(), name="chat-blocked-users-list"),
]
