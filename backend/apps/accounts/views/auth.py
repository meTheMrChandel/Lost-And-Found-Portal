"""
accounts/views/auth.py — OTP and Authentication API endpoints.
"""

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema
from django.conf import settings

from apps.accounts.models import User
from apps.accounts.serializers.auth import (
    RequestOTPSerializer,
    VerifyOTPSerializer,
    RegisterSerializer,
    PasswordResetConfirmSerializer,
)
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
                "message": f"Verification code sent to {email}. Please check your email inbox (and spam folder). Valid for 5 minutes.",
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


from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import IsAuthenticated
from apps.accounts.serializers.auth import CustomTokenObtainPairSerializer


class LoginView(TokenObtainPairView):
    """
    POST /api/v1/auth/login/
    Returns JWT access & refresh tokens.
    For web clients, sets secure httpOnly cookies.
    """
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            access_token = response.data.get("access")
            refresh_token = response.data.get("refresh")

            # Set httpOnly cookies for Web clients
            response.set_cookie(
                key="access_token",
                value=access_token,
                httponly=True,
                samesite="Lax",
                max_age=15 * 60,
            )
            response.set_cookie(
                key="refresh_token",
                value=refresh_token,
                httponly=True,
                samesite="Lax",
                max_age=7 * 24 * 60 * 60,
            )
        return response


class LogoutView(APIView):
    """
    POST /api/v1/auth/logout/
    Blacklists the refresh token and clears web auth cookies.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh") or request.COOKIES.get("refresh_token")
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
        except Exception:
            pass  # token already invalid or expired

        response = Response(
            {"success": True, "message": "Successfully logged out."},
            status=status.HTTP_200_OK,
        )
        response.delete_cookie("access_token")
        response.delete_cookie("refresh_token")
        return response


class PasswordResetConfirmView(APIView):
    """
    POST /api/v1/auth/password-reset-confirm/
    Verifies OTP and resets user password.
    """
    permission_classes = [AllowAny]

    @extend_schema(request=PasswordResetConfirmSerializer, responses={200: dict})
    def post(self, request):
        from apps.accounts.serializers.auth import PasswordResetConfirmSerializer
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        code = serializer.validated_data["code"]
        new_password = serializer.validated_data["new_password"]

        is_valid, err_msg = verify_otp(email=email, code=code, purpose=OTP.Purpose.PASSWORD_RESET)
        if not is_valid:
            return Response(
                {"success": False, "code": "invalid_otp", "message": err_msg},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.filter(email=email).first()
        if not user:
            return Response(
                {"success": False, "message": "User not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        user.set_password(new_password)
        user.save()

        return Response(
            {"success": True, "message": "Password updated successfully. You may now log in."},
            status=status.HTTP_200_OK,
        )



