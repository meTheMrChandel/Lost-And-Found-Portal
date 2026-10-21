"""Exception types used across the sandbox."""


class QRSandboxError(Exception):
    """Base class for all sandbox errors."""


class InvalidTokenError(QRSandboxError):
    """The item token is not a canonical UUID4 string."""


class InvalidScanUrlError(QRSandboxError):
    """The URL is not a valid scan URL for this portal."""


class ValidationError(QRSandboxError):
    """User supplied data failed validation."""


class ItemNotFoundError(QRSandboxError):
    """No item is registered under the given token."""


class NotOwnerError(QRSandboxError):
    """The acting user does not own the item."""


class QRInactiveError(QRSandboxError):
    """The QR code for this item has been deactivated by its owner."""


class RateLimitExceeded(QRSandboxError):
    """Too many requests; retry after `retry_after` seconds."""

    def __init__(self, retry_after: float):
        super().__init__(f"rate limit exceeded, retry in {retry_after:.0f}s")
        self.retry_after = retry_after


class BackendUnavailableError(QRSandboxError):
    """An optional QR backend library is not installed."""
