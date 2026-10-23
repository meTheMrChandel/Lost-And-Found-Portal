"""
notifications/views.py — API views for user notifications and unread tracking.
"""

from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsNotBanned
from apps.notifications.models import Notification
from apps.notifications.serializers import NotificationSerializer


class NotificationListView(generics.ListAPIView):
    """
    GET /api/v1/notifications/
    List all notifications for the authenticated user with optional ?unread=true filter.
    """
    permission_classes = [IsAuthenticated, IsNotBanned]
    serializer_class = NotificationSerializer

    def get_queryset(self):
        qs = Notification.objects.filter(recipient=self.request.user)
        unread = self.request.query_params.get("unread")
        if unread and unread.lower() == "true":
            qs = qs.filter(is_read=False)
        return qs.order_by("-created_at")


class NotificationMarkReadView(APIView):
    """
    POST /api/v1/notifications/<pk>/read/
    Marks a single notification as read.
    """
    permission_classes = [IsAuthenticated, IsNotBanned]

    def post(self, request, pk):
        notif = get_object_or_404(Notification, pk=pk, recipient=request.user)
        if not notif.is_read:
            notif.is_read = True
            notif.read_at = timezone.now()
            notif.save(update_fields=["is_read", "read_at"])

        return Response(
            {
                "success": True,
                "message": "Notification marked as read.",
                "data": NotificationSerializer(notif).data,
            },
            status=status.HTTP_200_OK,
        )


class NotificationMarkAllReadView(APIView):
    """
    POST /api/v1/notifications/mark-all-read/
    Marks all notifications for the authenticated user as read.
    """
    permission_classes = [IsAuthenticated, IsNotBanned]

    def post(self, request):
        updated_count = Notification.objects.filter(
            recipient=request.user, is_read=False
        ).update(is_read=True, read_at=timezone.now())

        return Response(
            {
                "success": True,
                "message": f"{updated_count} notification(s) marked as read.",
                "updated_count": updated_count,
            },
            status=status.HTTP_200_OK,
        )


class NotificationUnreadCountView(APIView):
    """
    GET /api/v1/notifications/unread-count/
    Returns real-time badge count of unread notifications.
    """
    permission_classes = [IsAuthenticated, IsNotBanned]

    def get(self, request):
        count = Notification.objects.filter(recipient=request.user, is_read=False).count()
        return Response({"unread_count": count}, status=status.HTTP_200_OK)
