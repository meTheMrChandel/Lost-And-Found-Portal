"""
adminpanel/views/settings.py — Site settings management for campus administrators.
"""

from rest_framework import status
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from apps.accounts.permissions import IsCampusAdmin
from apps.posts.models import SiteSettings


class SiteSettingsSerializer(serializers.ModelSerializer):
    """Serializer for campus-wide operational thresholds and expiry times."""
    class Meta:
        model = SiteSettings
        fields = [
            "match_threshold",
            "post_expiry_days",
            "otp_expiry_seconds",
            "otp_max_attempts",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]


class AdminSiteSettingsView(APIView):
    """
    GET /api/v1/adminpanel/settings/ — Retrieve campus operational settings
    PATCH /api/v1/adminpanel/settings/ — Update matching threshold and retention parameters
    """
    permission_classes = [IsCampusAdmin]

    @extend_schema(responses={200: SiteSettingsSerializer})
    def get(self, request):
        site_settings = SiteSettings.get()
        serializer = SiteSettingsSerializer(site_settings)
        return Response({"success": True, "data": serializer.data}, status=status.HTTP_200_OK)

    @extend_schema(request=SiteSettingsSerializer, responses={200: SiteSettingsSerializer})
    def patch(self, request):
        site_settings = SiteSettings.get()
        serializer = SiteSettingsSerializer(site_settings, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {
                "success": True,
                "message": "Campus site configuration updated successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )
