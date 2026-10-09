"""
accounts/serializers/users.py — User profile and device serializers.
"""

from rest_framework import serializers
from apps.accounts.models import DeviceToken, User


class UserProfileSerializer(serializers.ModelSerializer):
    """
    Serializer for viewing and updating personal student profile.
    Email and registration number are strictly read-only.
    """
    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "registration_number",
            "full_name",
            "department",
            "program_year",
            "hostel",
            "phone",
            "photo",
            "is_staff",
            "date_joined",
        ]
        read_only_fields = [
            "id",
            "email",
            "registration_number",
            "is_staff",
            "date_joined",
        ]


class DeviceTokenSerializer(serializers.ModelSerializer):
    """Serializer for registering push notification device tokens."""
    class Meta:
        model = DeviceToken
        fields = ["token", "platform", "is_active"]
