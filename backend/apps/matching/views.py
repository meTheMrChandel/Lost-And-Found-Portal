"""
matching/views.py — Endpoints for the Match queue, review actions, and execution.
"""

import hashlib
import secrets
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsCampusAdmin, IsNotBanned
from apps.posts.models import Post
from apps.matching.models import Match, MatchAuditLog
from apps.matching.serializers import (
    MatchActionSerializer,
    MatchCloseSerializer,
    MatchDetailSerializer,
    MatchHandoverVerifySerializer,
    MatchListSerializer,
    MatchMeetingModeSerializer,
    MatchProofRecordSerializer,
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


# ─── Phase 6: Verification & Handover Views ─────────────────────────────────

class AdminMatchProofRecordView(APIView):
    """
    POST /api/v1/matching/<pk>/proof/
    Admin asks hidden-proof questions (e.g. colour, scratches, wallpaper, serial number)
    and records claimant responses.
    - If all answers verified and decision="VERIFIED": status -> verified
    - If answers wrong or decision="KEEP_PENDING": status -> proof_pending
    - If decision="REJECT": status -> dismissed
    """
    permission_classes = [IsCampusAdmin, IsNotBanned]

    def post(self, request, pk):
        match = get_object_or_404(Match, pk=pk)
        serializer = MatchProofRecordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        questions = serializer.validated_data["questions"]
        decision = serializer.validated_data.get("decision", "VERIFIED")
        notes = serializer.validated_data.get("notes", "")
        from_status = match.status

        # If any question is marked not correct, force status to remain proof_pending
        all_correct = all(q.get("is_correct", True) for q in questions)

        if decision == "REJECT":
            new_status = Match.Status.DISMISSED
            action_name = "PROOF_REJECTED"
        elif decision == "VERIFIED" and all_correct:
            new_status = Match.Status.VERIFIED
            match.proof_verified_at = timezone.now()
            action_name = "PROOF_VERIFIED"
        else:
            new_status = Match.Status.PROOF_PENDING
            action_name = "PROOF_PENDING"

        match.status = new_status
        match.proof_questions = questions
        if notes:
            match.admin_notes = notes
        match.save(update_fields=["status", "proof_questions", "proof_verified_at", "admin_notes", "updated_at"])

        MatchAuditLog.objects.create(
            match=match,
            admin=request.user,
            action=action_name,
            from_status=from_status,
            to_status=new_status,
            notes=notes or f"Admin evaluated proof Q&A. Result status: {new_status}.",
        )

        return Response(
            {
                "success": True,
                "message": f"Proof recorded. Match status is now {new_status}.",
                "match": MatchDetailSerializer(match, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )


class MatchMeetingModeView(APIView):
    """
    POST /api/v1/matching/<pk>/meeting-mode/
    Meeting mode chosen by the parties or admin:
      - direct: Direct meet between students
      - office: Via campus security or admin office
    """
    permission_classes = [IsAuthenticated, IsNotBanned]

    def post(self, request, pk):
        match = get_object_or_404(Match, pk=pk)
        is_admin = request.user.is_staff or getattr(request.user, "is_campus_admin", False)
        is_party = request.user.id in [match.lost_post.author_id, match.found_post.author_id]

        if not (is_admin or is_party):
            return Response(
                {"detail": "Not authorized to set meeting mode for this case."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = MatchMeetingModeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        mode = serializer.validated_data["meeting_mode"]
        match.meeting_mode = mode
        match.save(update_fields=["meeting_mode", "updated_at"])

        MatchAuditLog.objects.create(
            match=match,
            admin=request.user if is_admin else None,
            action="SET_MEETING_MODE",
            from_status=match.status,
            to_status=match.status,
            notes=f"Meeting mode set to '{mode}' by {request.user.email}.",
        )

        return Response(
            {
                "success": True,
                "message": f"Meeting mode set to {mode}.",
                "meeting_mode": mode,
            },
            status=status.HTTP_200_OK,
        )


class AdminGenerateHandoverCodeView(APIView):
    """
    POST /api/v1/matching/<pk>/handover-code/generate/
    Admin generates a secure one-time handover code for owner verification.
    Stores only the SHA-256 hash in handover_code_hash.
    Returns the plaintext code for claimant presentation.
    """
    permission_classes = [IsCampusAdmin, IsNotBanned]

    def post(self, request, pk):
        match = get_object_or_404(Match, pk=pk)

        # Generate a cryptographically secure 6-character alphanumeric code
        alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
        code = "".join(secrets.choice(alphabet) for _ in range(6))

        # Store SHA-256 hash
        code_hash = hashlib.sha256(code.encode("utf-8")).hexdigest()
        match.handover_code_hash = code_hash
        match.handover_code_used = False
        match.save(update_fields=["handover_code_hash", "handover_code_used", "updated_at"])

        MatchAuditLog.objects.create(
            match=match,
            admin=request.user,
            action="HANDOVER_CODE_GENERATED",
            from_status=match.status,
            to_status=match.status,
            notes="Admin generated one-time handover verification code.",
        )

        return Response(
            {
                "success": True,
                "code": code,
                "message": "One-time handover code generated successfully. Share with the rightful owner.",
            },
            status=status.HTTP_200_OK,
        )


class AdminVerifyHandoverCodeView(APIView):
    """
    POST /api/v1/matching/<pk>/handover-code/verify/
    Owner presents code at handover. Admin verifies it.
    Code is single-use: verified once and then immediately marked used (expires).
    Moves match status to handed_over.
    """
    permission_classes = [IsCampusAdmin, IsNotBanned]

    def post(self, request, pk):
        match = get_object_or_404(Match, pk=pk)
        serializer = MatchHandoverVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        input_code = serializer.validated_data["code"].strip().upper()
        notes = serializer.validated_data.get("notes", "")

        if not match.handover_code_hash:
            return Response(
                {"detail": "No handover code has been generated for this case."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if match.handover_code_used:
            return Response(
                {"detail": "Handover code has already been used and is now expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check hash match in constant time
        input_hash = hashlib.sha256(input_code.encode("utf-8")).hexdigest()
        if not secrets.compare_digest(input_hash, match.handover_code_hash):
            return Response(
                {"detail": "Invalid handover code. Please check and try again."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Code matched: mark used and transition to handed_over
        from_status = match.status
        match.handover_code_used = True
        match.status = Match.Status.HANDED_OVER
        match.handed_over_at = timezone.now()
        if notes:
            match.admin_notes = notes
        match.save(update_fields=["handover_code_used", "status", "handed_over_at", "admin_notes", "updated_at"])

        MatchAuditLog.objects.create(
            match=match,
            admin=request.user,
            action="HANDOVER_VERIFIED",
            from_status=from_status,
            to_status=Match.Status.HANDED_OVER,
            notes=notes or "Handover code verified successfully. Item marked handed over.",
        )

        return Response(
            {
                "success": True,
                "message": "Handover code verified successfully. Belonging handed over.",
                "match": MatchDetailSerializer(match, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )


class AdminMatchCloseView(APIView):
    """
    POST /api/v1/matching/<pk>/close/
    Finalize case: settle reward, credit finder, and close match.
    Updates both Lost and Found posts to 'RETURNED'.
    """
    permission_classes = [IsCampusAdmin, IsNotBanned]

    def post(self, request, pk):
        match = get_object_or_404(Match, pk=pk)
        serializer = MatchCloseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reward_amount = serializer.validated_data.get("reward_amount_settled", 0.0)
        notes = serializer.validated_data.get("notes", "")
        from_status = match.status

        # Update Match
        match.status = Match.Status.CLOSED
        match.reward_amount_settled = reward_amount
        match.reward_settled_at = timezone.now()
        if notes:
            match.admin_notes = notes
        match.save(
            update_fields=[
                "status",
                "reward_amount_settled",
                "reward_settled_at",
                "admin_notes",
                "updated_at",
            ]
        )

        # Update Posts to RETURNED
        lost_post = match.lost_post
        found_post = match.found_post

        lost_post.status = Post.Status.RETURNED
        lost_post.save(update_fields=["status", "updated_at"])

        found_post.status = Post.Status.RETURNED
        found_post.save(update_fields=["status", "updated_at"])

        MatchAuditLog.objects.create(
            match=match,
            admin=request.user,
            action="CASE_CLOSED",
            from_status=from_status,
            to_status=Match.Status.CLOSED,
            notes=(
                f"Case successfully closed. Reward settled: ₹{reward_amount}. "
                f"Posts marked RETURNED. {notes}"
            ).strip(),
        )

        return Response(
            {
                "success": True,
                "message": "Case closed successfully. Reward settled and posts marked returned.",
                "match": MatchDetailSerializer(match, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )
