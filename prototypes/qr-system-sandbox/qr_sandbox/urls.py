"""Scan URLs: the only thing a QR code encodes (FR-QR-2)."""

from urllib.parse import urlsplit

from .constants import DEFAULT_BASE_URL, SCAN_PATH_PREFIX
from .errors import InvalidScanUrlError, InvalidTokenError
from .tokens import normalize_token


def build_scan_url(token: str, base_url: str = DEFAULT_BASE_URL) -> str:
    """Return https://<host>/qr/<uuid> for a token."""
    token = normalize_token(token)
    return f"{base_url.rstrip('/')}{SCAN_PATH_PREFIX}{token}"


def parse_scan_url(url: str, base_url: str = DEFAULT_BASE_URL) -> str:
    """Extract the item token from a scan URL, or raise InvalidScanUrlError."""
    parts = urlsplit(url)
    base = urlsplit(base_url)
    if (parts.scheme.lower(), parts.netloc.lower()) != (
        base.scheme.lower(),
        base.netloc.lower(),
    ):
        raise InvalidScanUrlError(f"URL does not belong to {base_url}")
    if not parts.path.startswith(SCAN_PATH_PREFIX):
        raise InvalidScanUrlError("URL is not a scan URL")
    raw = parts.path[len(SCAN_PATH_PREFIX):].rstrip("/")
    try:
        return normalize_token(raw)
    except InvalidTokenError as exc:
        raise InvalidScanUrlError("scan URL has no valid item token") from exc
