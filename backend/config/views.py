"""
config/views.py — Landing page view for the Lost & Found Portal backend root (/).
"""

from django.shortcuts import render
from django.http import HttpRequest, HttpResponse
from apps.posts.models import Post, Category
from apps.matching.models import Match


def landing_page_view(request: HttpRequest) -> HttpResponse:
    """
    Renders an ocean-themed welcome landing page for visitors accessing http://127.0.0.1:8000/
    """
    try:
        active_posts_count = Post.objects.filter(is_active=True).count()
        resolved_matches_count = Match.objects.filter(status=Match.MatchStatus.HANDED_OVER).count()
        categories = list(Category.objects.all().order_by("order", "name")[:8])
    except Exception:
        active_posts_count = 0
        resolved_matches_count = 0
        categories = []

    context = {
        "active_posts_count": active_posts_count,
        "resolved_matches_count": resolved_matches_count,
        "categories": categories,
        "frontend_url": "http://localhost:3000",
    }
    return render(request, "landing.html", context)


# ─── Operational endpoints ────────────────────────────────────────────────────
import redis
from django.conf import settings
from django.db import connection
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    """
    GET /api/v1/health/ — for uptime monitors and container health checks.
    200 when the database and Redis (chat + Celery broker) answer, 503 otherwise.
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = []

    def get(self, request):
        checks = {}
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            checks["database"] = "ok"
        except Exception:
            checks["database"] = "unavailable"
        try:
            redis.Redis.from_url(settings.REDIS_URL, socket_connect_timeout=2).ping()
            checks["redis"] = "ok"
        except Exception:
            checks["redis"] = "unavailable"
        healthy = all(value == "ok" for value in checks.values())
        return Response({"status": "ok" if healthy else "degraded", "checks": checks}, status=200 if healthy else 503)


class AppConfigView(APIView):
    """
    GET /api/v1/app-config/ — lets the mobile app force or suggest an update.
    Versions come from settings so a release can raise them without a code change.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        return Response(
            {
                "success": True,
                "data": {
                    "min_supported_version": settings.MOBILE_MIN_SUPPORTED_VERSION,
                    "latest_version": settings.MOBILE_LATEST_VERSION,
                    "update_url": settings.MOBILE_UPDATE_URL,
                },
            }
        )
