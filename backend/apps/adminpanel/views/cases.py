"""
adminpanel/views/cases.py — Case queue, review, and moderation endpoints for staff.
"""

from datetime import datetime, timedelta
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, OpenApiParameter

from apps.accounts.permissions import IsCampusAdmin
from apps.adminpanel.models import PostAuditLog
from apps.adminpanel.serializers import (
    AdminPostDetailSerializer,
    AdminPostListSerializer,
    AdminPostReviewSerializer,
)
from apps.posts.lifecycle import new_expiry_date, sla_cutoff
from apps.posts.models import Category, Post


class AdminPostQueueView(APIView):
    """
    GET /api/v1/adminpanel/posts/
    List and filter all posts across campus (Staff only).
    """

    permission_classes = [IsCampusAdmin]

    @extend_schema(
        parameters=[
            OpenApiParameter(name="status", description="Filter by status", required=False, type=str),
            OpenApiParameter(name="category", description="Filter by category slug", required=False, type=str),
            OpenApiParameter(name="post_type", description="Filter by post type (LOST/FOUND)", required=False, type=str),
            OpenApiParameter(name="search", description="Search title, description, or author", required=False, type=str),
            OpenApiParameter(name="sla_breached", description="Filter SLA breached pending cases", required=False, type=bool),
            OpenApiParameter(name="date_from", description="Filter posts from date (YYYY-MM-DD)", required=False, type=str),
            OpenApiParameter(name="date_to", description="Filter posts to date (YYYY-MM-DD)", required=False, type=str),
        ],
        responses={200: AdminPostListSerializer(many=True)},
    )
    def get(self, request):
        posts = (
            Post.objects.select_related("category", "author")
            .prefetch_related("images")
            .order_by("-created_at")
        )

        status_param = request.query_params.get("status")
        if status_param and status_param != "ALL":
            posts = posts.filter(status=status_param.upper())

        category_param = request.query_params.get("category")
        if category_param:
            posts = posts.filter(category_id=category_param)

        post_type_param = request.query_params.get("post_type")
        if post_type_param:
            posts = posts.filter(post_type=post_type_param.upper())

        search_param = request.query_params.get("search")
        if search_param:
            q = search_param.strip()
            posts = posts.filter(
                Q(title__icontains=q)
                | Q(description__icontains=q)
                | Q(last_seen_place__icontains=q)
                | Q(author__full_name__icontains=q)
                | Q(author__email__icontains=q)
                | Q(author__registration_number__icontains=q)
            )

        sla_param = request.query_params.get("sla_breached")
        if sla_param in ["true", "True", True]:
            posts = posts.filter(status=Post.Status.PENDING, created_at__lt=sla_cutoff())

        date_from = request.query_params.get("date_from")
        if date_from:
            try:
                dt = datetime.strptime(date_from, "%Y-%m-%d")
                posts = posts.filter(created_at__gte=dt)
            except ValueError:
                pass

        date_to = request.query_params.get("date_to")
        if date_to:
            try:
                dt = datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1)
                posts = posts.filter(created_at__lt=dt)
            except ValueError:
                pass

        serializer = AdminPostListSerializer(posts, many=True)
        return Response({"success": True, "data": serializer.data}, status=status.HTTP_200_OK)


class AdminPostDetailView(APIView):
    """
    GET /api/v1/adminpanel/posts/<id>/
    Retrieve comprehensive details of any post (Staff only).
    """

    permission_classes = [IsCampusAdmin]

    @extend_schema(responses={200: AdminPostDetailSerializer})
    def get(self, request, pk):
        try:
            post = (
                Post.objects.select_related("category", "author", "reviewed_by")
                .prefetch_related("images")
                .get(pk=pk)
            )
        except Post.DoesNotExist:
            raise NotFound("Post not found.")

        serializer = AdminPostDetailSerializer(post)
        return Response({"success": True, "data": serializer.data}, status=status.HTTP_200_OK)


class AdminPostReviewView(APIView):
    """
    POST /api/v1/adminpanel/posts/<id>/review/
    Approve, reject, request information, hide, or change category of a post (Staff only).
    """

    permission_classes = [IsCampusAdmin]

    @extend_schema(
        request=AdminPostReviewSerializer,
        responses={200: AdminPostDetailSerializer},
    )
    def post(self, request, pk):
        try:
            post = Post.objects.select_related("category", "author").get(pk=pk)
        except Post.DoesNotExist:
            raise NotFound("Post not found.")

        serializer = AdminPostReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        action = serializer.validated_data["action"]
        remarks = serializer.validated_data.get("remarks", "").strip()
        new_category_slug = serializer.validated_data.get("new_category", "").strip()

        old_status = post.status

        if action == "APPROVE":
            post.status = Post.Status.APPROVED
            post.admin_remarks = remarks
            post.reviewed_by = request.user
            post.reviewed_at = timezone.now()
            # The expiry timer runs from approval, not from when the report was submitted
            post.expires_at = new_expiry_date(post.reviewed_at)
            post.expiry_reminder_sent_at = None
            post.save()

            PostAuditLog.objects.create(
                post=post,
                admin=request.user,
                action="APPROVE",
                previous_status=old_status,
                new_status=post.status,
                notes=remarks or "Post approved and published to campus feed.",
            )

        elif action == "REJECT":
            post.status = Post.Status.REJECTED
            post.admin_remarks = remarks
            post.reviewed_by = request.user
            post.reviewed_at = timezone.now()
            post.save()

            PostAuditLog.objects.create(
                post=post,
                admin=request.user,
                action="REJECT",
                previous_status=old_status,
                new_status=post.status,
                notes=remarks,
            )

        elif action == "INFO_REQUESTED":
            post.status = Post.Status.INFO_REQUESTED
            post.admin_remarks = remarks
            post.reviewed_by = request.user
            post.reviewed_at = timezone.now()
            post.save()

            PostAuditLog.objects.create(
                post=post,
                admin=request.user,
                action="INFO_REQUESTED",
                previous_status=old_status,
                new_status=post.status,
                notes=remarks,
            )

        elif action == "HIDE":
            post.status = Post.Status.HIDDEN
            post.admin_remarks = remarks
            post.reviewed_by = request.user
            post.reviewed_at = timezone.now()
            post.save()

            PostAuditLog.objects.create(
                post=post,
                admin=request.user,
                action="HIDE",
                previous_status=old_status,
                new_status=post.status,
                notes=remarks or "Post hidden by campus administrator.",
            )

        elif action == "CHANGE_CATEGORY":
            old_cat_name = post.category.name
            new_cat = Category.objects.get(slug=new_category_slug)
            post.category = new_cat
            post.save()

            PostAuditLog.objects.create(
                post=post,
                admin=request.user,
                action="CHANGE_CATEGORY",
                previous_status=old_status,
                new_status=post.status,
                notes=f"Category changed from {old_cat_name} to {new_cat.name}. {remarks}".strip(),
            )

        elif action == "DELETE":
            PostAuditLog.objects.create(
                post=post,
                admin=request.user,
                action="DELETE",
                previous_status=old_status,
                new_status="DELETED",
                notes=remarks or "Post deleted by admin.",
            )
            post.delete()
            return Response(
                {"success": True, "message": "Post was successfully deleted."},
                status=status.HTTP_200_OK,
            )

        updated_serializer = AdminPostDetailSerializer(post)
        return Response(
            {
                "success": True,
                "message": f"Action '{action}' executed successfully on post.",
                "data": updated_serializer.data,
            },
            status=status.HTTP_200_OK,
        )
