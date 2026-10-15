"""
adminpanel/views/invites.py — Admin invitation and elevation endpoints.
"""

from datetime import timedelta
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from apps.accounts.models import User
from apps.accounts.permissions import IsCampusAdmin
from apps.adminpanel.models import AdminInvite
from apps.adminpanel.serializers import (
    AcceptAdminInviteSerializer,
    AdminInviteCreateSerializer,
    AdminInviteListSerializer,
)


class AdminInviteListCreateView(APIView):
    """
    GET /api/v1/adminpanel/invites/ — List sent invitations (Admin only)
    POST /api/v1/adminpanel/invites/ — Generate and email an admin invitation (Admin only)
    """
    permission_classes = [IsCampusAdmin]

    @extend_schema(responses={200: AdminInviteListSerializer(many=True)})
    def get(self, request):
        invites = AdminInvite.objects.all().order_by("-created_at")
        serializer = AdminInviteListSerializer(invites, many=True)
        return Response({"success": True, "data": serializer.data}, status=status.HTTP_200_OK)

    @extend_schema(request=AdminInviteCreateSerializer, responses={201: AdminInviteListSerializer})
    def post(self, request):
        serializer = AdminInviteCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        invite_expiry_days = getattr(settings, "ADMIN_INVITE_EXPIRY_DAYS", 3)
        expires_at = timezone.now() + timedelta(days=invite_expiry_days)

        invite = AdminInvite.objects.create(
            email=email,
            invited_by=request.user,
            expires_at=expires_at,
        )

        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:3000")
        invite_link = f"{frontend_url}/admin/accept-invite?token={invite.token}"

        # Send invite email
        try:
            send_mail(
                subject="Invitation to join IIT Ropar Lost & Found Administration",
                message=(
                    f"Hello,\n\n"
                    f"You have been invited by {request.user.email} to join the "
                    f"administrative staff of the IIT Ropar Lost & Found Portal.\n\n"
                    f"Please click the link below to accept your invitation and activate your admin privileges:\n"
                    f"{invite_link}\n\n"
                    f"This link will expire in {invite_expiry_days} days.\n\n"
                    f"Best regards,\nCampus Administration"
                ),
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@iitrpr.ac.in"),
                recipient_list=[email],
                fail_silently=True,
            )
        except Exception:
            pass

        return Response(
            {
                "success": True,
                "message": f"Invitation successfully sent to {email}.",
                "data": AdminInviteListSerializer(invite).data,
            },
            status=status.HTTP_201_CREATED,
        )


class AcceptAdminInviteView(APIView):
    """
    POST /api/v1/adminpanel/invites/accept/
    Accept an admin invite token, elevate or create the user, and assign staff status.
    """
    permission_classes = [AllowAny]

    @extend_schema(request=AcceptAdminInviteSerializer, responses={200: dict})
    def post(self, request):
        serializer = AcceptAdminInviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        token = serializer.validated_data["token"]
        password = serializer.validated_data["password"]
        full_name = serializer.validated_data["full_name"]
        reg_no = serializer.validated_data.get("registration_number") or ""

        invite = AdminInvite.objects.filter(token=token).first()
        if not invite:
            return Response(
                {"success": False, "message": "Invalid invitation link."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if invite.is_used:
            return Response(
                {"success": False, "message": "This invitation link has already been used."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if timezone.now() > invite.expires_at:
            return Response(
                {"success": False, "message": "This invitation link has expired. Please ask an admin to re-send."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Elevate existing user or create a new admin account
        user, created = User.objects.get_or_create(
            email=invite.email,
            defaults={
                "full_name": full_name,
                "registration_number": reg_no if reg_no else f"ADM_{invite.token.hex[:8].upper()}",
                "is_staff": True,
                "is_email_verified": True,
            },
        )

        user.full_name = full_name
        user.is_staff = True
        user.is_email_verified = True
        user.set_password(password)
        user.save()

        # Mark invite as completed
        invite.is_used = True
        invite.used_at = timezone.now()
        invite.save()

        return Response(
            {
                "success": True,
                "message": f"Welcome {user.full_name}! Your administrator privileges have been activated. Please log in.",
            },
            status=status.HTTP_200_OK,
        )
