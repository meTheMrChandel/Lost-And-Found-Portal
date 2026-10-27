"""
accounts/authentication.py — Resilient JWT Authentication.

Gracefully handles expired or invalid JWT tokens on public endpoints:
- If token is valid: request.user is authenticated.
- If token is expired/invalid: instead of rejecting public endpoints with 401,
  falls back to AnonymousUser.
- For protected endpoints requiring authentication (IsAuthenticated), DRF's
  permission check cleanly enforces 401, triggering client-side token refresh.
"""

import logging
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed

logger = logging.getLogger(__name__)


class SafeJWTAuthentication(JWTAuthentication):
    """
    Subclass of JWTAuthentication that allows graceful fallback to AnonymousUser
    when an invalid or expired token is sent to a public endpoint.
    """

    def authenticate(self, request):
        header = self.get_header(request)
        if header is None:
            return None

        raw_token = self.get_raw_token(header)
        if raw_token is None:
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
            return self.get_user(validated_token), validated_token
        except (InvalidToken, AuthenticationFailed) as exc:
            # Fall back to AnonymousUser so public endpoints (AllowAny) remain accessible
            logger.debug("SafeJWTAuthentication caught invalid/expired token: %s", exc)
            return None
