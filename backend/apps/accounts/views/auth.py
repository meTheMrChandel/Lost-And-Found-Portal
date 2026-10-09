"""
accounts/views/auth.py — OTP and Authentication API endpoints.
"""

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from apps.accounts.models import User
from apps.accounts.serializers.auth import RequestOTPSerializer, VerifyOTPSerializer
from apps.accounts.utils import create_otp, send_otp_email, verify_otp


class RequestOTPView(APIView):
    """
    POST /api/v1/auth/request-otp/
    Generate and email a 6-digit verification code.
    """
    permission_classes = [AllowAny]

    @extend_schema(request=RequestOTPSerializer, responses={200: dict})
    def post(self, request):
        serializer = RequestOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        purpose = serializer.validated_data["purpose"]

        # Fetch user instance if one exists
        user = User.objects.filter(email=email).first()

        code = create_otp(email=email, purpose=purpose, user=user)
        send_otp_email(email=email, code=code, purpose=purpose)

        return Response(
            {
                "success": True,
                "message": f"Verification code sent to {email}. Valid for 5 minutes.",
            },
            status=status.HTTP_200_OK,
        )


class VerifyOTPView(APIView):
    """
    POST /api/v1/auth/verify-otp/
    Verify a submitted 6-digit OTP code against the database.
    """
    permission_classes = [AllowAny]

    @extend_schema(request=VerifyOTPSerializer, responses={200: dict})
    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        code = serializer.validated_data["code"]
        purpose = serializer.validated_data["purpose"]

        is_valid, err_msg = verify_otp(email=email, code=code, purpose=purpose)
        if not is_valid:
            return Response(
                {
                    "success": False,
                    "code": "invalid_otp",
                    "message": err_msg,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "success": True,
                "message": "OTP verified successfully. You may now complete registration.",
            },
            status=status.HTTP_200_OK,
        )


class RegisterView(APIView):
    """
    POST /api/v1/auth/register/
    Create a new student account after email verification.
    """
    permission_classes = [AllowAny]

    @extend_schema(request=RegisterSerializer, responses={201: dict})
    def post(self, request):
        from apps.accounts.serializers.auth import RegisterSerializer
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        return Response(
            {
                "success": True,
                "message": "Account created successfully. You can now log in.",
                "data": {
                    "id": str(user.id),
                    "email": user.email,
                    "full_name": user.full_name,
                    "registration_number": user.registration_number,
                },
            },
            status=status.HTTP_201_CREATED,
        )

