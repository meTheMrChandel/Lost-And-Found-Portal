"""Shared constants, aligned with the SRS."""

DEFAULT_BASE_URL = "https://lostandfound.iitrpr.ac.in"
SCAN_PATH_PREFIX = "/qr/"

# SRS 4.3 FR-POST-2: bicycle, phone, laptop, earbuds, other
ALLOWED_CATEGORIES = ("bicycle", "phone", "laptop", "earbuds", "other")

MAX_ITEM_NAME_LENGTH = 80

# Fields that must never appear on the public scan page (SRS 2.5, NFR-4).
PRIVATE_OWNER_FIELDS = ("email", "phone")
