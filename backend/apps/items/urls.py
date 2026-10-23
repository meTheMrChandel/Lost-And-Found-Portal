"""
items/urls.py — Routing for registered items, zero-knowledge QR scans, and sticker generation.
"""

from django.urls import path
from apps.items.views import (
    AdminRegisteredItemListView,
    PublicQRScanView,
    RegisteredItemQRStickerView,
    UserRegisteredItemDetailView,
    UserRegisteredItemListCreateView,
    UserRegisteredItemToggleActiveView,
)

urlpatterns = [
    # Student Valuables Management
    path("", UserRegisteredItemListCreateView.as_view(), name="user-items-list-create"),
    path("<uuid:pk>/", UserRegisteredItemDetailView.as_view(), name="user-item-detail"),
    path("<uuid:pk>/toggle-active/", UserRegisteredItemToggleActiveView.as_view(), name="user-item-toggle-active"),
    path("<uuid:pk>/sticker/", RegisteredItemQRStickerView.as_view(), name="user-item-qr-sticker"),

    # Public Scan Endpoint (Zero-knowledge)
    path("scan/<uuid:qr_uuid>/", PublicQRScanView.as_view(), name="public-qr-scan"),

    # Admin Valuables Directory
    path("admin/", AdminRegisteredItemListView.as_view(), name="admin-registered-items-list"),
]
