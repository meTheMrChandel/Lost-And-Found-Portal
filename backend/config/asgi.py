"""ASGI configuration for the Lost & Found Portal.

Handles both HTTP (Django) and WebSocket (Django Channels) connections.
"""

import os

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# Initialise Django ASGI app first so apps are ready
django_asgi_app = get_asgi_application()

# Import routing after Django is set up
from apps.chat import routing as chat_routing  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AllowedHostsOriginValidator(
            AuthMiddlewareStack(URLRouter(chat_routing.websocket_urlpatterns))
        ),
    }
)
