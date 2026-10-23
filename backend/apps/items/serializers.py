"""
items/serializers.py — Serializers for registered valuables & QR identification.
"""

from rest_framework import serializers

from apps.accounts.models import User
from apps.posts.models import Category
from apps.items.models import RegisteredItem


class ItemCategorySerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="slug", read_only=True)

    class Meta:
        model = Category
        fields = ["id", "slug", "name", "icon"]


class ItemOwnerSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "full_name", "email", "registration_number", "phone"]


class RegisteredItemSerializer(serializers.ModelSerializer):
    """Full detail view for the item's registered owner."""
    category = ItemCategorySerializer(read_only=True)
    scan_url = serializers.SerializerMethodField()

    class Meta:
        model = RegisteredItem
        fields = [
            "id",
            "name",
            "category",
            "description",
            "serial_number",
            "qr_uuid",
            "is_active",
            "deactivated_at",
            "scan_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "qr_uuid", "deactivated_at", "created_at", "updated_at"]

    def get_scan_url(self, obj: RegisteredItem) -> str:
        request = self.context.get("request")
        path = f"/scan/{obj.qr_uuid}"
        if request:
            return request.build_absolute_uri(path)
        return path


class RegisteredItemCreateSerializer(serializers.ModelSerializer):
    """Payload to register a new valuable item (bicycle, laptop, phone, etc.)."""
    category = serializers.SlugRelatedField(
        slug_field="slug",
        queryset=Category.objects.all(),
    )

    class Meta:
        model = RegisteredItem
        fields = [
            "name",
            "category",
            "description",
            "serial_number",
        ]

    def create(self, validated_data):
        user = self.context["request"].user
        return RegisteredItem.objects.create(owner=user, **validated_data)


class PublicQRScanSerializer(serializers.Serializer):
    """
    Zero-knowledge whitelisted public serializer for QR sticker scans.
    Shows ONLY the item name, category, and owner full name.
    Strictly conceals phone number, email, registration number, and serial number.
    """
    item_name = serializers.CharField()
    category = serializers.CharField()
    owner_name = serializers.CharField()
    qr_uuid = serializers.UUIDField()
    is_active = serializers.BooleanField()


class AdminRegisteredItemSerializer(serializers.ModelSerializer):
    """Full admin inspection serializer with student details."""
    category = ItemCategorySerializer(read_only=True)
    owner = ItemOwnerSummarySerializer(read_only=True)

    class Meta:
        model = RegisteredItem
        fields = [
            "id",
            "name",
            "category",
            "owner",
            "description",
            "serial_number",
            "qr_uuid",
            "is_active",
            "deactivated_at",
            "created_at",
            "updated_at",
        ]
