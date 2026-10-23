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
    UserBlockToggleView,
)

urlpatterns = [
    # Conversations
    path("conversations/", ConversationListCreateView.as_view(), name="conversations-list-create"),
    path("conversations/<uuid:pk>/", ConversationDetailView.as_view(), name="conversation-detail"),
    path("conversations/<uuid:pk>/messages/", ConversationMessagesListView.as_view(), name="conversation-messages"),
    path("conversations/<uuid:pk>/read/", ConversationMarkReadView.as_view(), name="conversation-mark-read"),
    path("conversations/<uuid:pk>/approve-direct/", ConversationApproveDirectChatView.as_view(), name="conversation-approve-direct"),

    # Block list
    path("block/", UserBlockToggleView.as_view(), name="chat-user-block-toggle"),
    path("blocked/", BlockedUserListView.as_view(), name="chat-blocked-users-list"),
]
