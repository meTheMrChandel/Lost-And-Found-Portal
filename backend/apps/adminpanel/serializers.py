"""
adminpanel/serializers.py — Serializers for admin management, invites, and audit logs.
"""

from rest_framework import serializers
from django.utils import timezone
from apps.adminpanel.models import AdminInvite, PostAuditLog
from apps.accounts.models import User, validate_iitrpr_email
from apps.posts.models import Post, PostImage, Category, AbuseReport
from apps.posts.lifecycle import sla_cutoff
from apps.posts.serializers import PostImageSerializer


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


class AdminPostListSerializer(serializers.ModelSerializer):
    """Serializer for the admin case queue listing."""
    author_name = serializers.CharField(source="author.full_name", read_only=True)
    author_email = serializers.EmailField(source="author.email", read_only=True)
    author_registration_number = serializers.CharField(source="author.registration_number", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    images = PostImageSerializer(many=True, read_only=True)
    is_sla_breached = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            "id",
            "title",
            "post_type",
            "category",
            "category_name",
            "status",
            "last_seen_place",
            "last_seen_time",
            "reward_amount",
            "admin_remarks",
            "author_name",
            "author_email",
            "author_registration_number",
            "images",
            "is_sla_breached",
            "created_at",
            "expires_at",
        ]

    def get_is_sla_breached(self, obj) -> bool:
        if obj.status != Post.Status.PENDING:
            return False
        # SLA breached if pending for longer than SiteSettings.admin_review_sla_hours.
        # Work the cutoff out once per response, not once per post.
        cutoff = self.context.setdefault("sla_cutoff", sla_cutoff())
        return obj.created_at < cutoff


class AdminAuthorProfileSerializer(serializers.ModelSerializer):
    """Detailed author profile for staff inspection."""
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
            "is_banned",
        ]


class AdminPostDetailSerializer(serializers.ModelSerializer):
    """Comprehensive serializer for admin case review including hidden proof and audit history."""
    author = AdminAuthorProfileSerializer(read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    images = PostImageSerializer(many=True, read_only=True)
    reviewed_by_email = serializers.EmailField(source="reviewed_by.email", read_only=True)
    audit_history = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            "id",
            "title",
            "post_type",
            "category",
            "category_name",
            "description",
            "last_seen_place",
            "last_seen_time",
            "hidden_proof",
            "reward_amount",
            "custody_location",
            "inform_admin_privately",
            "status",
            "admin_remarks",
            "author",
            "reviewed_by_email",
            "reviewed_at",
            "images",
            "audit_history",
            "created_at",
            "updated_at",
            "expires_at",
        ]

    def get_audit_history(self, obj):
        logs = PostAuditLog.objects.filter(post=obj).select_related("admin").order_by("-created_at")
        return PostAuditLogSerializer(logs, many=True).data


class AdminPostReviewSerializer(serializers.Serializer):
    """Payload serializer for admin moderation actions."""
    action = serializers.ChoiceField(
        choices=["APPROVE", "REJECT", "INFO_REQUESTED", "HIDE", "CHANGE_CATEGORY", "DELETE"]
    )
    remarks = serializers.CharField(required=False, allow_blank=True, default="")
    new_category = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        action = attrs.get("action")
        remarks = attrs.get("remarks", "").strip()
        new_category = attrs.get("new_category", "").strip()

        if action in ["REJECT", "INFO_REQUESTED"] and not remarks:
            raise serializers.ValidationError({"remarks": f"Remarks are required when action is {action}."})

        if action == "CHANGE_CATEGORY":
            if not new_category:
                raise serializers.ValidationError({"new_category": "new_category is required when changing category."})
            if not Category.objects.filter(slug=new_category).exists():
                raise serializers.ValidationError({"new_category": f"Category '{new_category}' does not exist."})

        return attrs


class AbuseReportSerializer(serializers.ModelSerializer):
    """Serializer for reviewing user reports of abuse."""
    reporter_email = serializers.EmailField(source="reporter.email", read_only=True)
    reporter_name = serializers.CharField(source="reporter.full_name", read_only=True)
    post_title = serializers.CharField(source="post.title", read_only=True)
    resolved_by_email = serializers.EmailField(source="resolved_by.email", read_only=True)

    class Meta:
        model = AbuseReport
        fields = [
            "id",
            "post",
            "post_title",
            "reporter",
            "reporter_name",
            "reporter_email",
            "reason",
            "description",
            "is_resolved",
            "resolved_by_email",
            "created_at",
        ]
