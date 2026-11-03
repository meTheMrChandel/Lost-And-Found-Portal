"""
adminpanel/views/stats.py — Operational metrics and campus statistics for staff dashboard.
"""

from django.db.models import Count, Avg, F
from django.utils import timezone
from datetime import timedelta
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from apps.accounts.models import User
from apps.accounts.permissions import IsCampusAdmin
from apps.posts.lifecycle import RENEWAL_REMINDER_DAYS, sla_cutoff
from apps.posts.models import AbuseReport, Category, Post, SiteSettings
from apps.adminpanel.models import PostAuditLog
from apps.adminpanel.serializers import PostAuditLogSerializer


class AdminStatisticsView(APIView):
    """
    GET /api/v1/adminpanel/statistics/
    Comprehensive platform metrics (Staff only).
    """

    permission_classes = [IsCampusAdmin]

    @extend_schema(responses={200: dict})
    def get(self, request):
        now = timezone.now()
        last_7_days = now - timedelta(days=7)

        # User metrics
        total_users = User.objects.count()
        total_students = User.objects.filter(is_staff=False, is_superuser=False).count()
        banned_users = User.objects.filter(is_banned=True).count()
        new_users_week = User.objects.filter(date_joined__gte=last_7_days).count()

        # Post metrics
        total_posts = Post.objects.count()
        pending_posts = Post.objects.filter(status=Post.Status.PENDING).count()
        approved_posts = Post.objects.filter(status=Post.Status.APPROVED).count()
        info_requested_posts = Post.objects.filter(status=Post.Status.INFO_REQUESTED).count()
        returned_posts = Post.objects.filter(status=Post.Status.RETURNED).count()
        rejected_posts = Post.objects.filter(status=Post.Status.REJECTED).count()
        hidden_posts = Post.objects.filter(status=Post.Status.HIDDEN).count()
        expired_posts = Post.objects.filter(status=Post.Status.EXPIRED).count()
        # Live posts whose owners are due a renewal reminder (or have had one)
        expiring_soon_posts = Post.objects.filter(
            status=Post.Status.APPROVED,
            expires_at__gt=now,
            expires_at__lte=now + timedelta(days=RENEWAL_REMINDER_DAYS),
        ).count()
        site_settings = SiteSettings.get()

        # Posts by type
        lost_count = Post.objects.filter(post_type=Post.PostType.LOST).count()
        found_count = Post.objects.filter(post_type=Post.PostType.FOUND).count()

        # SLA breach: pending cases older than SiteSettings.admin_review_sla_hours
        sla_breached_count = Post.objects.filter(
            status=Post.Status.PENDING,
            created_at__lt=sla_cutoff(now),
        ).count()

        # Abuse reports
        pending_abuse_reports = AbuseReport.objects.filter(is_resolved=False).count()

        # Category distribution
        category_stats = list(
            Category.objects.annotate(posts_count=Count("posts"))
            .values("slug", "name", "posts_count")
            .order_by("-posts_count")
        )

        # Recent moderation audit logs
        recent_logs = (
            PostAuditLog.objects.select_related("post", "admin")
            .order_by("-created_at")[:6]
        )
        recent_activity = PostAuditLogSerializer(recent_logs, many=True).data

        return Response(
            {
                "success": True,
                "data": {
                    "users": {
                        "total": total_users,
                        "students": total_students,
                        "banned": banned_users,
                        "new_this_week": new_users_week,
                    },
                    "posts": {
                        "total": total_posts,
                        "lost": lost_count,
                        "found": found_count,
                        "pending": pending_posts,
                        "approved": approved_posts,
                        "info_requested": info_requested_posts,
                        "returned": returned_posts,
                        "rejected": rejected_posts,
                        "hidden": hidden_posts,
                        "expired": expired_posts,
                        "expiring_soon": expiring_soon_posts,
                        "sla_breached": sla_breached_count,
                    },
                    # The rules behind the counts above, so the dashboard can label them
                    "lifecycle": {
                        "review_sla_hours": site_settings.admin_review_sla_hours or 24,
                        "post_expiry_days": site_settings.post_expiry_days or 30,
                        "renewal_reminder_days": RENEWAL_REMINDER_DAYS,
                    },
                    "abuse_reports": {
                        "pending": pending_abuse_reports,
                    },
                    "category_breakdown": category_stats,
                    "recent_activity": recent_activity,
                },
            },
            status=status.HTTP_200_OK,
        )
