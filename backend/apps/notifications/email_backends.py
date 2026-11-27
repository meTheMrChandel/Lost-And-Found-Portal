"""
Email backend that sends through the Gmail API over HTTPS instead of SMTP.

Hosts such as Render's free plan block outbound SMTP ports (25, 465, 587), but port 443 is open,
so OTP and notification emails can still go out from a Gmail account.

Settings (all from the environment, see settings.py):
    EMAIL_BACKEND        = "apps.notifications.email_backends.GmailAPIBackend"
    GMAIL_CLIENT_ID      OAuth client of type "Desktop app" in Google Cloud Console
    GMAIL_CLIENT_SECRET
    GMAIL_REFRESH_TOKEN  from scripts/gmail_refresh_token.py, granted the gmail.send scope
    DEFAULT_FROM_EMAIL   the same Gmail address; Gmail replaces any other From address with it
"""

import base64
import json
import logging
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.core.mail.backends.base import BaseEmailBackend

logger = logging.getLogger(__name__)

TOKEN_URL = "https://oauth2.googleapis.com/token"
SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"

# One access token per process, refreshed a minute before Google expires it (normally after an hour)
_token_lock = threading.Lock()
_cached_token = {"value": "", "expires_at": 0.0}


class GmailAPIError(Exception):
    pass


def _post(url: str, data: bytes, headers: dict, timeout: int) -> dict:
    request = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode() or "{}")
    except urllib.error.HTTPError as exc:
        # Google explains the problem in the body (e.g. invalid_grant when the refresh token was revoked)
        detail = exc.read().decode(errors="replace")[:500]
        raise GmailAPIError(f"{url} returned {exc.code}: {detail}") from exc


class GmailAPIBackend(BaseEmailBackend):
    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)
        self.client_id = getattr(settings, "GMAIL_CLIENT_ID", "")
        self.client_secret = getattr(settings, "GMAIL_CLIENT_SECRET", "")
        self.refresh_token = getattr(settings, "GMAIL_REFRESH_TOKEN", "")
        self.timeout = getattr(settings, "EMAIL_TIMEOUT", None) or 10

    def _access_token(self) -> str:
        if not (self.client_id and self.client_secret and self.refresh_token):
            raise ImproperlyConfigured(
                "GmailAPIBackend needs GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN."
            )
        with _token_lock:
            if _cached_token["value"] and time.time() < _cached_token["expires_at"]:
                return _cached_token["value"]
            body = urllib.parse.urlencode(
                {
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "refresh_token": self.refresh_token,
                    "grant_type": "refresh_token",
                }
            ).encode()
            payload = _post(
                TOKEN_URL,
                body,
                {"Content-Type": "application/x-www-form-urlencoded"},
                self.timeout,
            )
            _cached_token["value"] = payload["access_token"]
            _cached_token["expires_at"] = time.time() + int(payload.get("expires_in", 3600)) - 60
            return _cached_token["value"]

    def _send(self, email_message) -> bool:
        if not email_message.recipients():
            return False
        mime = email_message.message()
        if email_message.bcc:
            # Django leaves Bcc out of the headers; Gmail reads it from here and strips it before delivery
            mime["Bcc"] = ", ".join(email_message.bcc)
        raw = base64.urlsafe_b64encode(mime.as_bytes(linesep="\r\n")).decode()
        _post(
            SEND_URL,
            json.dumps({"raw": raw}).encode(),
            {
                "Authorization": f"Bearer {self._access_token()}",
                "Content-Type": "application/json",
            },
            self.timeout,
        )
        return True

    def send_messages(self, email_messages):
        sent = 0
        for message in email_messages:
            try:
                if self._send(message):
                    sent += 1
            except Exception:
                logger.exception("Gmail API could not send email to %s", message.recipients())
                if not self.fail_silently:
                    raise
        return sent
