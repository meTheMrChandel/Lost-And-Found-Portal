"""
adminpanel/serializers.py — Serializers for admin management, invites, and audit logs.
"""

from rest_framework import serializers
from django.utils import timezone
from apps.adminpanel.models import AdminInvite, PostAuditLog
from apps.accounts.models import User, validate_iitrpr_email


class AdminInviteCreateSerializer(serializers.Serializer):
    """Serializer for generating and dispatching an admin invitation."""
    email = serializers.EmailField()

    def validate_email(self, value):
        email = value.lower().strip()
        validate_iitrpr_email(email)

        # Check if user is already a staff member
        user = User.objects.filter(email=email).first()
        if user and (user.is_staff or user.is_superuser):
            raise serializers.ValidationError("This user is already a registered administrator.")

        # Check for active unused invites
        active_invite = AdminInvite.objects.filter(
            email=email,
            is_used=False,
            expires_at__gt=timezone.now(),
        ).first()
        if active_invite:
            raise serializers.ValidationError("An active invitation is already pending for this email address.")

        return email


class AdminInviteListSerializer(serializers.ModelSerializer):
    """Serializer for displaying admin invitations."""
    invited_by_email = serializers.EmailField(source="invited_by.email", read_only=True)
    is_expired = serializers.SerializerMethodField()

    class Meta:
        model = AdminInvite
        fields = [
            "id",
            "token",
            "email",
            "invited_by_email",
            "is_used",
            "used_at",
            "expires_at",
            "created_at",
            "is_expired",
        ]

    def get_is_expired(self, obj):
        return timezone.now() > obj.expires_at


class AcceptAdminInviteSerializer(serializers.Serializer):
    """Serializer to accept an admin invite and set up password/profile."""
    token = serializers.UUIDField()
    password = serializers.CharField(write_only=True, min_length=8)
    full_name = serializers.CharField(max_length=255)
    registration_number = serializers.CharField(max_length=20, required=False, allow_blank=True)


class PostAuditLogSerializer(serializers.ModelSerializer):
    """Serializer for reviewing administrative actions on posts."""
    admin_email = serializers.EmailField(source="admin.email", read_only=True)
    post_title = serializers.CharField(source="post.title", read_only=True)

    class Meta:
        model = PostAuditLog
        fields = [
            "id",
            "post",
            "post_title",
            "admin",
            "admin_email",
            "action",
            "previous_status",
            "new_status",
            "notes",
            "created_at",
        ]
