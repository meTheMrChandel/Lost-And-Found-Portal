"""
chat/routing.py — WebSocket URL patterns for Django Channels.
"""

from django.urls import re_path
from apps.chat.consumers import ChatConsumer

websocket_urlpatterns = [
    re_path(r"^ws/chat/(?P<conversation_id>[0-9a-f-]+)/$", ChatConsumer.as_asgi()),
]
