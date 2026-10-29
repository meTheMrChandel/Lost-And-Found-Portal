"""
adminpanel/views/audit.py — Audit logging and administrative oversight.
"""

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from apps.accounts.permissions import IsCampusAdmin
from apps.adminpanel.models import PostAuditLog
from apps.adminpanel.serializers import PostAuditLogSerializer


class PostAuditLogListView(APIView):
    """
    GET /api/v1/adminpanel/audit-logs/
    Retrieve immutable history of administrative actions on posts (Admin only).
    """
    permission_classes = [IsCampusAdmin]

    @extend_schema(responses={200: PostAuditLogSerializer(many=True)})
    def get(self, request):
        logs = PostAuditLog.objects.select_related("post", "admin").all().order_by("-created_at")
        post_id = request.query_params.get("post_id")
        if post_id:
            # post_ref still matches after the post itself is deleted
            logs = logs.filter(post_ref=post_id)

        serializer = PostAuditLogSerializer(logs, many=True)
        return Response({"success": True, "data": serializer.data}, status=status.HTTP_200_OK)


def log_admin_action(post, admin, action, previous_status="", new_status="", notes=""):
    """
    Utility helper to record an administrative operation into PostAuditLog.
    """
    return PostAuditLog.objects.create(
        post=post,
        admin=admin,
        action=action,
        previous_status=previous_status,
        new_status=new_status,
        notes=notes,
    )
