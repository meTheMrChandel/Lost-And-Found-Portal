import base64
import email
import io
import json
import urllib.error
from unittest import mock

import pytest
from django.core.exceptions import ImproperlyConfigured
from django.core.mail import EmailMessage, send_mail

from apps.notifications import email_backends

BACKEND = "apps.notifications.email_backends.GmailAPIBackend"


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


@pytest.fixture
def gmail_settings(settings):
    settings.EMAIL_BACKEND = BACKEND
    settings.GMAIL_CLIENT_ID = "client-id"
    settings.GMAIL_CLIENT_SECRET = "client-secret"
    settings.GMAIL_REFRESH_TOKEN = "refresh-token"
    email_backends._cached_token.update(value="", expires_at=0.0)
    yield settings
    email_backends._cached_token.update(value="", expires_at=0.0)


def fake_google(calls):
    def urlopen(request, timeout=None):
        calls.append(request)
        if request.full_url == email_backends.TOKEN_URL:
            return FakeResponse(json.dumps({"access_token": "access-1", "expires_in": 3600}).encode())
        return FakeResponse(json.dumps({"id": "msg-1"}).encode())

    return urlopen


def sent_message(request):
    raw = json.loads(request.data)["raw"]
    return email.message_from_bytes(base64.urlsafe_b64decode(raw))


def test_sends_through_gmail_api_with_refreshed_token(gmail_settings):
    calls = []
    with mock.patch("urllib.request.urlopen", side_effect=fake_google(calls)):
        count = send_mail("Your OTP", "Code: 123456", "Lost & Found <me@gmail.com>", ["student@iitrpr.ac.in"])

    assert count == 1
    token_call, send_call = calls
    assert b"grant_type=refresh_token" in token_call.data
    assert b"refresh_token=refresh-token" in token_call.data
    assert send_call.full_url == email_backends.SEND_URL
    assert send_call.get_header("Authorization") == "Bearer access-1"
    message = sent_message(send_call)
    assert message["To"] == "student@iitrpr.ac.in"
    assert message["Subject"] == "Your OTP"
    assert "Code: 123456" in message.get_payload(decode=True).decode()


def test_reuses_access_token_until_it_expires(gmail_settings):
    calls = []
    with mock.patch("urllib.request.urlopen", side_effect=fake_google(calls)):
        send_mail("One", "a", "me@gmail.com", ["a@iitrpr.ac.in"])
        send_mail("Two", "b", "me@gmail.com", ["b@iitrpr.ac.in"])

    token_calls = [c for c in calls if c.full_url == email_backends.TOKEN_URL]
    assert len(token_calls) == 1
    assert len(calls) == 3


def test_bcc_recipients_are_kept(gmail_settings):
    calls = []
    with mock.patch("urllib.request.urlopen", side_effect=fake_google(calls)):
        EmailMessage("Hi", "body", "me@gmail.com", ["to@iitrpr.ac.in"], bcc=["hidden@iitrpr.ac.in"]).send()

    assert sent_message(calls[-1])["Bcc"] == "hidden@iitrpr.ac.in"


def test_google_error_raises_unless_fail_silently(gmail_settings):
    def urlopen(request, timeout=None):
        raise urllib.error.HTTPError(request.full_url, 400, "Bad Request", {}, io.BytesIO(b'{"error": "invalid_grant"}'))

    with mock.patch("urllib.request.urlopen", side_effect=urlopen):
        with pytest.raises(email_backends.GmailAPIError, match="invalid_grant"):
            send_mail("Hi", "body", "me@gmail.com", ["to@iitrpr.ac.in"])
        assert send_mail("Hi", "body", "me@gmail.com", ["to@iitrpr.ac.in"], fail_silently=True) == 0


def test_missing_credentials_is_a_clear_error(gmail_settings):
    gmail_settings.GMAIL_REFRESH_TOKEN = ""
    with pytest.raises(ImproperlyConfigured, match="GMAIL_REFRESH_TOKEN"):
        send_mail("Hi", "body", "me@gmail.com", ["to@iitrpr.ac.in"])
