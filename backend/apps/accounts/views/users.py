"""
accounts/views/users.py — Profile retrieval/update and Device Token endpoints.
"""

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from apps.accounts.models import DeviceToken
from apps.accounts.serializers.users import DeviceTokenSerializer, UserProfileSerializer


class UserProfileView(APIView):
    """
    GET /api/v1/users/me/
    PATCH /api/v1/users/me/
    View or update profile for currently authenticated user.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: UserProfileSerializer})
    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return Response(
            {"success": True, "data": serializer.data},
            status=status.HTTP_200_OK,
        )

    @extend_schema(request=UserProfileSerializer, responses={200: UserProfileSerializer})
    def patch(self, request):
        serializer = UserProfileSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {
                "success": True,
                "message": "Profile updated successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class RegisterDeviceTokenView(APIView):
    """
    POST /api/v1/users/device-token/
    Registers or updates FCM push notification device token.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(request=DeviceTokenSerializer, responses={200: dict})
    def post(self, request):
        serializer = DeviceTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        token = serializer.validated_data["token"]
        platform = serializer.validated_data.get("platform", "android")

        device, _ = DeviceToken.objects.update_or_create(
            user=request.user,
            token=token,
            defaults={"platform": platform, "is_active": True},
        )

        return Response(
            {"success": True, "message": "Device token registered successfully."},
            status=status.HTTP_200_OK,
        )
