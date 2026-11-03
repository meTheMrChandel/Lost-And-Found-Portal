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

    def validate_photo(self, photo):
        # Same limits as report photos (apps/posts/views.py)
        from apps.posts.views import ALLOWED_CONTENT_TYPES, MAX_IMAGE_SIZE_BYTES, _validate_image_magic_bytes

        if photo is None:
            return photo
        if photo.size > MAX_IMAGE_SIZE_BYTES:
            raise serializers.ValidationError("Profile photo must be 5MB or smaller.")
        if getattr(photo, "content_type", None) not in ALLOWED_CONTENT_TYPES or not _validate_image_magic_bytes(photo):
            raise serializers.ValidationError("Profile photo must be a JPG, PNG or WEBP image.")
        return photo


class DeviceTokenSerializer(serializers.ModelSerializer):
    """Serializer for registering push notification device tokens."""
    class Meta:
        model = DeviceToken
        fields = ["token", "platform", "is_active"]
