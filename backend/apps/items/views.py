"""
items/views.py — Registered valuables, zero-knowledge QR scans, and sticker generation.
"""

import io
import qrcode
import qrcode.image.svg
from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsCampusAdmin, IsNotBanned
from apps.items.models import RegisteredItem
from apps.items.serializers import (
    AdminRegisteredItemSerializer,
    PublicQRScanSerializer,
    RegisteredItemCreateSerializer,
    RegisteredItemSerializer,
)


class UserRegisteredItemListCreateView(generics.ListCreateAPIView):
    """
    GET /api/v1/items/  — List all valuables registered by the authenticated student.
    POST /api/v1/items/ — Register a new item (bicycle, laptop, phone) and generate QR UUID.
    """
    permission_classes = [IsAuthenticated, IsNotBanned]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return RegisteredItemCreateSerializer
        return RegisteredItemSerializer

    def get_queryset(self):
        return (
            RegisteredItem.objects.filter(owner=self.request.user)
            .select_related("category", "owner")
            .order_by("-created_at")
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        item = serializer.save()
        return Response(
            {
                "success": True,
                "message": "Valuable item successfully registered with QR code.",
                "data": RegisteredItemSerializer(item, context={"request": request}).data,
            },
            status=status.HTTP_201_CREATED,
        )


class UserRegisteredItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET /api/v1/items/<pk>/    — Retrieve item details.
    PATCH /api/v1/items/<pk>/  — Update item information.
    DELETE /api/v1/items/<pk>/ — Remove registered item.
    """
    permission_classes = [IsAuthenticated, IsNotBanned]
    serializer_class = RegisteredItemSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or getattr(user, "is_campus_admin", False):
            return RegisteredItem.objects.all().select_related("category", "owner")
        return RegisteredItem.objects.filter(owner=user).select_related("category", "owner")


class UserRegisteredItemToggleActiveView(APIView):
    """
    POST /api/v1/items/<pk>/toggle-active/
    Toggles the active state of a registered item's QR code.
    When deactivated, public scans will display a neutral deactivated notice.
    """
    permission_classes = [IsAuthenticated, IsNotBanned]

    def post(self, request, pk):
        user = request.user
        if user.is_staff or getattr(user, "is_campus_admin", False):
            item = get_object_or_404(RegisteredItem, pk=pk)
        else:
            item = get_object_or_404(RegisteredItem, pk=pk, owner=user)

        item.is_active = not item.is_active
        if not item.is_active:
            item.deactivated_at = timezone.now()
        else:
            item.deactivated_at = None
        item.save(update_fields=["is_active", "deactivated_at", "updated_at"])

        state_msg = "activated" if item.is_active else "deactivated"
        return Response(
            {
                "success": True,
                "message": f"QR sticker successfully {state_msg}.",
                "is_active": item.is_active,
                "deactivated_at": item.deactivated_at,
            },
            status=status.HTTP_200_OK,
        )


class RegisteredItemQRStickerView(APIView):
    """
    GET /api/v1/items/<pk>/sticker/
    Returns a printable SVG QR sticker designed for IIT Ropar campus valuables.
    Encodes the non-identifying URL: /scan/<qr_uuid>
    """
    permission_classes = [IsAuthenticated, IsNotBanned]

    def get(self, request, pk):
        user = request.user
        if user.is_staff or getattr(user, "is_campus_admin", False):
            item = get_object_or_404(RegisteredItem, pk=pk)
        else:
            item = get_object_or_404(RegisteredItem, pk=pk, owner=user)

        # Build scan link
        scan_url = request.build_absolute_uri(f"/scan/{item.qr_uuid}")

        # Generate SVG QR Code
        factory = qrcode.image.svg.SvgPathImage
        img = qrcode.make(scan_url, image_factory=factory, box_size=12)
        stream = io.BytesIO()
        img.save(stream)
        svg_content = stream.getvalue().decode("utf-8")

        # Return SVG or JSON based on format parameter
        if request.query_params.get("format") == "json":
            return Response(
                {
                    "success": True,
                    "item_id": str(item.id),
                    "name": item.name,
                    "category": item.category.name,
                    "scan_url": scan_url,
                    "svg": svg_content,
                    "data": {
                        "svg": svg_content,
                        "scan_url": scan_url,
                    },
                },
                status=status.HTTP_200_OK,
            )

        return HttpResponse(svg_content, content_type="image/svg+xml")


class PublicQRScanView(APIView):
    """
    GET /api/v1/items/scan/<uuid:qr_uuid>/
    Public endpoint hit when any phone camera scans the QR sticker.
    Returns strictly whitelisted fields: item name, category, and owner name.
    Strictly conceals phone number, email, registration number, and serial numbers.
    If deactivated, returns a neutral, non-identifying notice.
    """
    permission_classes = [AllowAny]

    def get(self, request, qr_uuid):
        try:
            item = RegisteredItem.objects.select_related("category", "owner").get(qr_uuid=qr_uuid)
        except RegisteredItem.DoesNotExist:
            return Response(
                {
                    "is_active": False,
                    "message": "Invalid QR code. No item registered with this identification.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # Deactivated QR Check
        if not item.is_active:
            return Response(
                {
                    "is_active": False,
                    "item_name": item.name,
                    "message": "This QR sticker is deactivated or has been retired by its owner.",
                },
                status=status.HTTP_200_OK,
            )

        serializer = PublicQRScanSerializer(item.public_qr_data)
        return Response(
            {
                "success": True,
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class AdminRegisteredItemListView(generics.ListAPIView):
    """
    GET /api/v1/items/admin/
    Campus Admin search and directory for all registered valuables.
    Supports filtering by item name, serial number, owner name, or registration number.
    """
    permission_classes = [IsCampusAdmin, IsNotBanned]
    serializer_class = AdminRegisteredItemSerializer

    def get_queryset(self):
        qs = RegisteredItem.objects.select_related("category", "owner").all()

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(serial_number__icontains=search)
                | Q(owner__full_name__icontains=search)
                | Q(owner__registration_number__icontains=search)
                | Q(owner__email__icontains=search)
            )

        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category__slug=category)

        active = self.request.query_params.get("is_active")
        if active is not None:
            qs = qs.filter(is_active=(active.lower() == "true"))

        return qs.order_by("-created_at")
