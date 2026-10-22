"""Scan URLs: the only thing a QR code encodes (FR-QR-2)."""

from urllib.parse import urlsplit

from .constants import DEFAULT_BASE_URL, SCAN_PATH_PREFIX
from .errors import InvalidScanUrlError, InvalidTokenError
from .tokens import normalize_token


def build_scan_url(token: str, base_url: str = DEFAULT_BASE_URL) -> str:
    """Return https://<host>/qr/<uuid> for a token."""
    token = normalize_token(token)
    return f"{base_url.rstrip('/')}{SCAN_PATH_PREFIX}{token}"
