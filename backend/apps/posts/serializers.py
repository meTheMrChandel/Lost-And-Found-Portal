"""
posts/serializers.py — Serializers for Categories, Posts, and Attachments.
"""

from datetime import timedelta
from decimal import Decimal
from django.utils import timezone
from rest_framework import serializers

from apps.posts.models import Category, Post, PostImage


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
