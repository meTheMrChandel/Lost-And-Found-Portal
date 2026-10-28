"""
posts/serializers.py — Serializers for Categories, Posts, and Attachments.
"""

from datetime import timedelta
from decimal import Decimal
from django.utils import timezone
from rest_framework import serializers

from apps.posts.models import Category, Post, PostImage, AbuseReport


class CategorySerializer(serializers.ModelSerializer):
    """Serializer for item categories available in the portal."""

    class Meta:
        model = Category
        fields = ["slug", "name", "icon", "order", "is_sensitive"]


class PostImageSerializer(serializers.ModelSerializer):
    """Serializer for photos attached to a lost or found post."""

    class Meta:
        model = PostImage
        fields = ["id", "image", "thumbnail", "order", "uploaded_at"]


class LostPostCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for submitting a new Lost Item report (User 1 flow).
    Creates post in PENDING status for administrative review.
    """

    category = serializers.SlugRelatedField(
        slug_field="slug",
        queryset=Category.objects.all(),
    )
    reward_amount = serializers.DecimalField(
        max_digits=8,
        decimal_places=2,
        min_value=Decimal("0.00"),
        default=Decimal("0.00"),
        required=False,
    )
    hidden_proof = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Identifying details only the owner would know. Never shown publicly.",
    )

    class Meta:
        model = Post
        fields = [
            "id",
            "title",
            "category",
            "description",
            "last_seen_place",
            "last_seen_time",
            "hidden_proof",
            "reward_amount",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "status", "created_at"]

    def to_internal_value(self, data):
        # Support mobile / frontend field aliases
        mutable_data = data.copy() if hasattr(data, "copy") else dict(data)
        if "campus_location" in mutable_data and "last_seen_place" not in mutable_data:
            mutable_data["last_seen_place"] = mutable_data["campus_location"]
        if "incident_date" in mutable_data and "last_seen_time" not in mutable_data:
            val = str(mutable_data["incident_date"])
            if val and len(val) == 10 and "T" not in val:
                val = f"{val}T12:00:00Z"
            mutable_data["last_seen_time"] = val
        if "last_seen_time" not in mutable_data or not mutable_data["last_seen_time"]:
            mutable_data["last_seen_time"] = timezone.now().isoformat()
        return super().to_internal_value(mutable_data)

    def validate_last_seen_time(self, value):
        # Prevent reporting items lost in the future
        now_with_buffer = timezone.now() + timedelta(minutes=5)
        if value > now_with_buffer:
            raise serializers.ValidationError("Last seen date and time cannot be in the future.")
        return value

    def validate_reward_amount(self, value):
        if value < Decimal("0.00"):
            raise serializers.ValidationError("Reward amount cannot be negative.")
        return value


class LostPostListSerializer(serializers.ModelSerializer):
    """
    Summary serializer for listing user's reports or feeds.
    Omits confidential verification proof for safety.
    """

    category = serializers.SlugRelatedField(slug_field="slug", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    images = PostImageSerializer(many=True, read_only=True)

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
            "images",
            "created_at",
            "expires_at",
        ]


class LostPostDetailSerializer(serializers.ModelSerializer):
    """
    Detailed serializer for a single lost post.
    Enforces privacy by restricting hidden_proof exclusively to the author and staff.
    """

    category = serializers.SlugRelatedField(slug_field="slug", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    images = PostImageSerializer(many=True, read_only=True)
    author_name = serializers.CharField(source="author.full_name", read_only=True)
    author_registration_number = serializers.CharField(
        source="author.registration_number", read_only=True
    )
    hidden_proof = serializers.SerializerMethodField()

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
            "status",
            "admin_remarks",
            "images",
            "author_name",
            "author_registration_number",
            "created_at",
            "updated_at",
            "expires_at",
        ]

    def get_hidden_proof(self, obj) -> str | None:
        request = self.context.get("request")
        if not request or not request.user or not request.user.is_authenticated:
            return None

        user = request.user
        # Only the author or staff/superuser may inspect the hidden proof
        if user == obj.author or user.is_staff or user.is_superuser:
            return obj.hidden_proof
        return None


class LostPostUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for author editing their lost post.
    Modifications are permitted only when post is PENDING or INFO_REQUESTED.
    """

    category = serializers.SlugRelatedField(
        slug_field="slug",
        queryset=Category.objects.all(),
        required=False,
    )

    class Meta:
        model = Post
        fields = [
            "title",
            "category",
            "description",
            "last_seen_place",
            "last_seen_time",
            "hidden_proof",
            "reward_amount",
        ]

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        if instance and instance.status not in [Post.Status.PENDING, Post.Status.INFO_REQUESTED]:
            raise serializers.ValidationError(
                f"Cannot modify post while in '{instance.get_status_display()}' status."
            )
        return attrs


class FoundPostCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for submitting a Found Item report (User 2 flow).
    Supports custody location selection and optional private admin disclosure.
    """

    category = serializers.SlugRelatedField(
        slug_field="slug",
        queryset=Category.objects.all(),
    )
    custody_location = serializers.ChoiceField(
        choices=Post.CustodyLocation.choices,
        default=Post.CustodyLocation.WITH_FINDER,
    )
    inform_admin_privately = serializers.BooleanField(
        default=False,
        help_text="If true, item is visible only to campus administrators.",
    )

    class Meta:
        model = Post
        fields = [
            "id",
            "title",
            "category",
            "description",
            "last_seen_place",
            "last_seen_time",
            "custody_location",
            "inform_admin_privately",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "status", "created_at"]

    def to_internal_value(self, data):
        # Support mobile / frontend field aliases
        mutable_data = data.copy() if hasattr(data, "copy") else dict(data)
        if "campus_location" in mutable_data and "last_seen_place" not in mutable_data:
            mutable_data["last_seen_place"] = mutable_data["campus_location"]
        if "incident_date" in mutable_data and "last_seen_time" not in mutable_data:
            val = str(mutable_data["incident_date"])
            if val and len(val) == 10 and "T" not in val:
                val = f"{val}T12:00:00Z"
            mutable_data["last_seen_time"] = val
        if "last_seen_time" not in mutable_data or not mutable_data["last_seen_time"]:
            mutable_data["last_seen_time"] = timezone.now().isoformat()
        if "custody_mode" in mutable_data and "custody_location" not in mutable_data:
            mode = mutable_data["custody_mode"]
            if mode in [Post.CustodyLocation.WITH_FINDER, Post.CustodyLocation.ADMIN_OFFICE, Post.CustodyLocation.SECURITY_OFFICE]:
                mutable_data["custody_location"] = mode
            else:
                mutable_data["custody_location"] = Post.CustodyLocation.WITH_FINDER
        if "is_private_admin_only" in mutable_data and "inform_admin_privately" not in mutable_data:
            val = mutable_data["is_private_admin_only"]
            mutable_data["inform_admin_privately"] = str(val).lower() in ["true", "1", "yes"]
        return super().to_internal_value(mutable_data)

    def validate_last_seen_time(self, value):
        now_with_buffer = timezone.now() + timedelta(minutes=5)
        if value > now_with_buffer:
            raise serializers.ValidationError("Found date and time cannot be in the future.")
        return value


class PublicFeedPostSerializer(serializers.ModelSerializer):
    """
    Public feed serializer.
    Guarantees strict privacy:
      - Sensitive items (wallet/cash) excluded
      - Private admin items excluded
      - Hidden proofs completely omitted
      - Only displays approved posts
    """

    category = serializers.SlugRelatedField(slug_field="slug", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    images = PostImageSerializer(many=True, read_only=True)
    author_name = serializers.CharField(source="author.full_name", read_only=True)
    author_registration_number = serializers.CharField(
        source="author.registration_number", read_only=True
    )

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
            "reward_amount",
            "custody_location",
            "images",
            "author_name",
            "author_registration_number",
            "created_at",
            "expires_at",
        ]


class AbuseReportCreateSerializer(serializers.ModelSerializer):
    """Serializer for students submitting abuse/fraud reports on a post."""

    class Meta:
        model = AbuseReport
        fields = ["reason", "description"]

    def validate(self, attrs):
        request = self.context.get("request")
        post = self.context.get("post")
        if request and post:
            if AbuseReport.objects.filter(post=post, reporter=request.user).exists():
                raise serializers.ValidationError("You have already reported this post for review.")
        return attrs
