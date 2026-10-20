"""
adminpanel/views/abuse.py — Abuse reports moderation endpoints for staff.
"""

from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, OpenApiParameter

from apps.accounts.permissions import IsCampusAdmin
from apps.adminpanel.serializers import AbuseReportSerializer
from apps.posts.models import AbuseReport


class AdminAbuseReportListView(APIView):
    """
    GET /api/v1/adminpanel/abuse-reports/
    List reported posts requiring administrative intervention (Staff only).
    """

    permission_classes = [IsCampusAdmin]

    @extend_schema(
        parameters=[
            OpenApiParameter(name="is_resolved", description="Filter resolved state", required=False, type=bool),
        ],
        responses={200: AbuseReportSerializer(many=True)},
    )
    def get(self, request):
        reports = (
            AbuseReport.objects.select_related("post", "reporter", "resolved_by")
            .order_by("-created_at")
        )

        resolved_param = request.query_params.get("is_resolved")
        if resolved_param is not None:
            is_resolved = resolved_param in ["true", "True", True]
            reports = reports.filter(is_resolved=is_resolved)

        serializer = AbuseReportSerializer(reports, many=True)
        return Response({"success": True, "data": serializer.data}, status=status.HTTP_200_OK)


class AdminAbuseReportResolveView(APIView):
    """
    POST /api/v1/adminpanel/abuse-reports/<id>/resolve/
    Mark an abuse report as investigated and resolved (Staff only).
    """

    permission_classes = [IsCampusAdmin]

    def post(self, request, pk):
        try:
            report = AbuseReport.objects.get(pk=pk)
        except AbuseReport.DoesNotExist:
            raise NotFound("Abuse report not found.")

        report.is_resolved = True
        report.resolved_by = request.user
        report.save()

        serializer = AbuseReportSerializer(report)
        return Response(
            {
                "success": True,
                "message": "Abuse report marked as resolved.",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )
