"""
adminpanel/views/users.py — Admin-level student management and moderation.
"""

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import serializers
from drf_spectacular.utils import extend_schema

from apps.accounts.models import User
from apps.accounts.permissions import IsCampusAdmin
from apps.accounts.serializers.users import UserProfileSerializer


class AdminUserListSerializer(serializers.ModelSerializer):
    """Detailed user representation for administrative inspection."""
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
            "is_active",
            "is_staff",
            "is_superuser",
            "is_banned",
            "ban_reason",
            "date_joined",
        ]


class BanUserSerializer(serializers.Serializer):
    """Serializer for suspending or reinstating a student account."""
    is_banned = serializers.BooleanField()
    ban_reason = serializers.CharField(required=False, allow_blank=True)


class AdminUserListView(APIView):
    """
    GET /api/v1/adminpanel/users/
    List all campus users with moderation filters (Admin only).
    """
    permission_classes = [IsCampusAdmin]

    @extend_schema(responses={200: AdminUserListSerializer(many=True)})
    def get(self, request):
        query = User.objects.all().order_by("-date_joined")
        search = request.query_params.get("search")
        if search:
            query = query.filter(
                email__icontains=search
            ) | query.filter(
                full_name__icontains=search
            ) | query.filter(
                registration_number__icontains=search
            )

        serializer = AdminUserListSerializer(query, many=True)
        return Response({"success": True, "data": serializer.data}, status=status.HTTP_200_OK)


class AdminUserModerationView(APIView):
    """
    POST /api/v1/adminpanel/users/<uuid:user_id>/moderate/
    Suspend or reinstate a student account (Admin only).
    """
    permission_classes = [IsCampusAdmin]

    @extend_schema(request=BanUserSerializer, responses={200: dict})
    def post(self, request, user_id):
        serializer = BanUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        target_user = User.objects.filter(id=user_id).first()
        if not target_user:
            return Response(
                {"success": False, "message": "User not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if target_user.is_superuser:
            return Response(
                {"success": False, "message": "Superuser accounts cannot be suspended."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        is_banned = serializer.validated_data["is_banned"]
        ban_reason = serializer.validated_data.get("ban_reason", "")

        target_user.is_banned = is_banned
        target_user.ban_reason = ban_reason if is_banned else ""
        target_user.save(update_fields=["is_banned", "ban_reason"])

        action_text = "suspended" if is_banned else "reinstated"
        return Response(
            {
                "success": True,
                "message": f"User {target_user.email} has been {action_text}.",
                "data": AdminUserListSerializer(target_user).data,
            },
            status=status.HTTP_200_OK,
        )
