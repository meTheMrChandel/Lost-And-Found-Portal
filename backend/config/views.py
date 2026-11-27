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
        "frontend_url": settings.FRONTEND_URL,
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


class ScheduledJobsView(APIView):
    """
    POST /api/v1/internal/run-scheduled-jobs/ — one step of the twice-daily run, for hosts without
    a Celery worker and beat (e.g. Render's free plan). Body:
        {"step": "lifecycle"}                      renewal reminders, auto-expiry, review SLA alerts
        {"step": "matching", "after": <cursor>}    one batch of MATCHING_BATCH_SIZE lost reports
    The reply carries "next_after" (null when matching is done) and "delay_seconds", the pause the
    caller should wait before asking for the next batch. Splitting the run keeps every request short
    and spreads the load. Called by .github/workflows/scheduled-jobs.yml with the shared secret in
    the X-Cron-Secret header; returns 404 while CRON_SECRET is unset.
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = []

    def post(self, request):
        import hmac
        import logging

        from apps.matching.services import run_matching
        from apps.posts.lifecycle import run_post_lifecycle

        expected = settings.CRON_SECRET
        if not expected:
            return Response({"success": False, "message": "Not found."}, status=404)
        given = request.headers.get("X-Cron-Secret", "")
        if not hmac.compare_digest(given.encode(), expected.encode()):
            return Response({"success": False, "message": "Invalid cron secret."}, status=403)

        step = request.data.get("step")
        logger = logging.getLogger(__name__)
        if step == "lifecycle":
            result = run_post_lifecycle()
            data = {"step": step, "result": result, "next_after": None}
        elif step == "matching":
            after = request.data.get("after") or None
            if after is not None:
                import uuid

                try:
                    after = str(uuid.UUID(str(after)))
                except ValueError:
                    return Response({"success": False, "message": "after must be a report id."}, status=400)
            result = run_matching(batch_size=settings.MATCHING_BATCH_SIZE, after=after)
            data = {"step": step, "result": result, "next_after": result["next_after"]}
        else:
            return Response(
                {"success": False, "message": 'step must be "lifecycle" or "matching".'}, status=400
            )
        data["delay_seconds"] = settings.BATCH_DELAY_SECONDS
        logger.info("Scheduled step %s finished: %s", step, result)
        return Response({"success": True, "data": data})


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
