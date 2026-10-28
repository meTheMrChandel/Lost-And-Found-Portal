"""
chat/middleware.py — JWT authentication for WebSocket connections.

Browsers cannot set an Authorization header on a WebSocket handshake, so clients
pass their access token in the query string instead: ws/chat/<id>/?token=<jwt>.
"""

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed, InvalidToken


@database_sync_to_async
def get_user_for_token(raw_token: str):
    """Resolve an access token to its user, or AnonymousUser if it is invalid or expired."""
    auth = JWTAuthentication()
    try:
        validated_token = auth.get_validated_token(raw_token)
        return auth.get_user(validated_token)
    except (InvalidToken, AuthenticationFailed):
        return AnonymousUser()


class JWTQueryAuthMiddleware(BaseMiddleware):
    """
    Sets scope["user"] from a ?token=<access token> query parameter.

    Without a token the scope is left as is, so session auth from
    AuthMiddlewareStack (e.g. the Django admin) still works.
    """

    async def __call__(self, scope, receive, send):
        query = parse_qs(scope.get("query_string", b"").decode())
        token = query.get("token", [None])[0]
        if token:
            scope = dict(scope)
            scope["user"] = await get_user_for_token(token)
        return await super().__call__(scope, receive, send)
