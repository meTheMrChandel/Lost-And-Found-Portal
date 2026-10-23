"""
matching/serializers.py — Serializers for Match queue, details, and review actions.
"""

from rest_framework import serializers

from apps.accounts.models import User
from apps.posts.models import Post, PostImage, Category
from apps.matching.models import Match, MatchAuditLog


class MatchCategorySummarySerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="slug", read_only=True)

    class Meta:
        model = Category
        fields = ["id", "slug", "name", "icon", "is_sensitive"]


class MatchAuthorSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "full_name", "email", "phone", "registration_number"]


class MatchPostSummarySerializer(serializers.ModelSerializer):
    category = MatchCategorySummarySerializer(read_only=True)
    author = MatchAuthorSummarySerializer(read_only=True)
    images = serializers.SerializerMethodField()
    hidden_proof = serializers.SerializerMethodField()
    location = serializers.CharField(source="last_seen_place", read_only=True)
    date_lost_or_found = serializers.DateTimeField(source="last_seen_time", read_only=True)
    custody = serializers.CharField(source="custody_location", read_only=True)

    class Meta:
        model = Post
        fields = [
            "id",
            "title",
            "description",
            "post_type",
            "status",
            "category",
            "last_seen_place",
            "last_seen_time",
            "location",
            "date_lost_or_found",
            "reward_amount",
            "custody_location",
            "custody",
            "inform_admin_privately",
            "author",
            "images",
            "hidden_proof",
            "created_at",
        ]

    def get_images(self, obj: Post):
        request = self.context.get("request")
        urls = []
        for img in obj.images.all():
            if img.image:
                urls.append(request.build_absolute_uri(img.image.url) if request else img.image.url)
        return urls

    def get_hidden_proof(self, obj: Post):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        # Only campus admins or author can see hidden_proof
        is_admin = request.user.is_staff or getattr(request.user, "is_campus_admin", False)
        if is_admin or request.user.id == obj.author_id:
            return obj.hidden_proof
        return None


class MatchAuditLogSerializer(serializers.ModelSerializer):
    admin_name = serializers.SerializerMethodField()

    class Meta:
        model = MatchAuditLog
        fields = [
            "id",
            "action",
            "from_status",
            "to_status",
            "notes",
            "created_at",
            "admin_name",
        ]

    def get_admin_name(self, obj: MatchAuditLog):
        if obj.admin:
            return obj.admin.full_name or obj.admin.email
        return "System"


class MatchListSerializer(serializers.ModelSerializer):
    lost_post = MatchPostSummarySerializer(read_only=True)
    found_post = MatchPostSummarySerializer(read_only=True)

    class Meta:
        model = Match
        fields = [
            "id",
            "score",
            "status",
            "meeting_mode",
            "lost_post",
            "found_post",
            "created_at",
            "updated_at",
        ]


class MatchDetailSerializer(serializers.ModelSerializer):
    lost_post = MatchPostSummarySerializer(read_only=True)
    found_post = MatchPostSummarySerializer(read_only=True)
    audit_logs = MatchAuditLogSerializer(many=True, read_only=True)

    class Meta:
        model = Match
        fields = [
            "id",
            "score",
            "status",
            "meeting_mode",
            "proof_questions",
            "proof_verified_at",
            "handover_code_used",
            "handed_over_at",
            "reward_amount_settled",
            "reward_settled_at",
            "admin_notes",
            "lost_post",
            "found_post",
            "audit_logs",
            "created_at",
            "updated_at",
        ]


class MatchActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(
        choices=["CONFIRM", "DISMISS"],
        required=True,
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="")
