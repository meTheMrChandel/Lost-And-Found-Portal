"""
matching/views.py — Endpoints for the Match queue, review actions, and execution.
"""

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsCampusAdmin, IsNotBanned
from apps.matching.models import Match, MatchAuditLog
from apps.matching.serializers import (
    MatchActionSerializer,
    MatchDetailSerializer,
    MatchListSerializer,
)
from apps.matching.services import run_matching


class AdminMatchListView(generics.ListAPIView):
    """
    GET /api/v1/matching/
    Admin endpoint to view suggested and confirmed match pairs.
    """
    permission_classes = [IsCampusAdmin, IsNotBanned]
    serializer_class = MatchListSerializer

    def get_queryset(self):
        qs = (
            Match.objects.select_related(
                "lost_post",
                "found_post",
                "lost_post__category",
                "found_post__category",
                "lost_post__author",
                "found_post__author",
            )
            .prefetch_related("lost_post__images", "found_post__images")
            .all()
        )

        # Status filter
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter.lower())

        # Min score filter
        min_score = self.request.query_params.get("min_score")
        if min_score:
            try:
                qs = qs.filter(score__gte=float(min_score))
            except ValueError:
                pass

        # Text search across titles & locations
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(lost_post__title__icontains=search)
                | Q(found_post__title__icontains=search)
                | Q(lost_post__last_seen_place__icontains=search)
                | Q(found_post__last_seen_place__icontains=search)
            )

        return qs.order_by("-score", "-created_at")


class AdminMatchDetailView(generics.RetrieveAPIView):
    """
    GET /api/v1/matching/<pk>/
    Admin endpoint for detailed inspection of a match pair and its audit history.
    """
    permission_classes = [IsCampusAdmin, IsNotBanned]
    serializer_class = MatchDetailSerializer
    queryset = Match.objects.select_related(
        "lost_post",
        "found_post",
        "lost_post__category",
        "found_post__category",
        "lost_post__author",
        "found_post__author",
    ).prefetch_related(
        "lost_post__images",
        "found_post__images",
        "audit_logs__admin",
    )


class AdminMatchActionView(APIView):
    """
    POST /api/v1/matching/<pk>/action/
    Perform review actions on a match:
      - CONFIRM: suggested → confirmed
      - DISMISS: → dismissed
    """
    permission_classes = [IsCampusAdmin, IsNotBanned]

    def post(self, request, pk):
        match = get_object_or_404(Match, pk=pk)
        serializer = MatchActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        action = serializer.validated_data["action"]
        notes = serializer.validated_data.get("notes", "")
        from_status = match.status

        if action == "CONFIRM":
            match.status = Match.Status.CONFIRMED
            match.admin_notes = notes or match.admin_notes
            match.assigned_to = request.user
            match.save(update_fields=["status", "admin_notes", "assigned_to", "updated_at"])

            MatchAuditLog.objects.create(
                match=match,
                admin=request.user,
                action="CONFIRM_MATCH",
                from_status=from_status,
                to_status=Match.Status.CONFIRMED,
                notes=notes or "Admin confirmed suggested match pair.",
            )

        elif action == "DISMISS":
            match.status = Match.Status.DISMISSED
            match.admin_notes = notes or match.admin_notes
            match.save(update_fields=["status", "admin_notes", "updated_at"])

            MatchAuditLog.objects.create(
                match=match,
                admin=request.user,
                action="DISMISS_MATCH",
                from_status=from_status,
                to_status=Match.Status.DISMISSED,
                notes=notes or "Admin dismissed suggested match pair.",
            )

        return Response(
            {
                "success": True,
                "message": f"Match successfully updated to {match.status}.",
                "match": MatchDetailSerializer(match, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )


class AdminRunMatchingView(APIView):
    """
    POST /api/v1/matching/run/
    Manually trigger the matching algorithm across active posts on demand.
    """
    permission_classes = [IsCampusAdmin, IsNotBanned]

    def post(self, request):
        post_id = request.data.get("post_id")
        result = run_matching(post_id=post_id)
        return Response(
            {
                "success": True,
                "message": "Matching engine executed successfully.",
                "data": result,
            },
            status=status.HTTP_200_OK,
        )


class MyPostMatchesView(generics.ListAPIView):
    """
    GET /api/v1/matching/my-matches/
    Enables authenticated students to view confirmed matches for their posts.
    """
    permission_classes = [IsAuthenticated, IsNotBanned]
    serializer_class = MatchListSerializer

    def get_queryset(self):
        user = self.request.user
        # Only return confirmed or verified matches to the student (not raw dismissed or suggested)
        allowed_statuses = [
            Match.Status.CONFIRMED,
            Match.Status.PROOF_PENDING,
            Match.Status.VERIFIED,
            Match.Status.HANDED_OVER,
            Match.Status.CLOSED,
        ]
        return (
            Match.objects.filter(
                Q(lost_post__author=user) | Q(found_post__author=user),
                status__in=allowed_statuses,
            )
            .select_related(
                "lost_post",
                "found_post",
                "lost_post__category",
                "found_post__category",
                "lost_post__author",
                "found_post__author",
            )
            .prefetch_related("lost_post__images", "found_post__images")
            .order_by("-updated_at")
        )
