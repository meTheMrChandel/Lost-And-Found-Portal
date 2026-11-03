"""
notifications/serializers.py — Serializers for in-app user notifications.
"""

from rest_framework import serializers
from apps.notifications.models import Notification

T = Notification.NotifType

# Web page each kind of notification opens. The web and mobile clients render
# notification_type / message / action_url; notif_type / body / data stay for older callers.
ACTION_URLS = {
    "chat_message": "/chat",
    T.POST_APPROVED: "/my-reports",
    T.POST_REJECTED: "/my-reports",
    T.INFO_REQUESTED: "/my-reports",
    T.POST_EXPIRING: "/my-reports",
    T.POST_EXPIRED: "/my-reports",
    T.MATCH_FOUND: "/my-reports",
    T.HANDOVER_READY: "/my-reports",
    T.REWARD_RECORDED: "/my-reports",
    T.REVIEW_OVERDUE: "/admin/cases?sla_breached=true",
}


class NotificationSerializer(serializers.ModelSerializer):
    notification_type = serializers.CharField(source="notif_type", read_only=True)
    message = serializers.CharField(source="body", read_only=True)
    action_url = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id",
            "notif_type",
            "notification_type",
            "title",
            "body",
            "message",
            "data",
            "action_url",
            "is_read",
            "read_at",
            "created_at",
        ]
        read_only_fields = ["id", "notif_type", "title", "body", "data", "created_at"]

    def get_action_url(self, obj: Notification):
        data = obj.data or {}
        if data.get("event") == "possible_match" and data.get("found_post_id"):
            return f"/feed?post={data['found_post_id']}"
        url = ACTION_URLS.get(obj.notif_type)
        if url is not None:
            return url

        if "abuse_report_id" in data:
            return "/admin/abuse-reports"
        if data.get("post_id"):
            # General notices about a post: admins get case-queue alerts (a new report to
            # review, a case assigned to them), students notices about their own reports
            return "/admin/cases" if self._viewer_is_staff(obj) else "/my-reports"
        return None

    def _viewer_is_staff(self, obj: Notification) -> bool:
        # Users only ever list their own notifications, so the viewer is the recipient
        request = self.context.get("request")
        viewer = request.user if request and request.user.is_authenticated else obj.recipient
        return viewer.is_staff
