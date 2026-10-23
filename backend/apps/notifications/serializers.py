"""
notifications/serializers.py — Serializers for in-app user notifications.
"""

from rest_framework import serializers
from apps.notifications.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id",
            "notif_type",
            "title",
            "body",
            "data",
            "is_read",
            "read_at",
            "created_at",
        ]
        read_only_fields = ["id", "notif_type", "title", "body", "data", "created_at"]
