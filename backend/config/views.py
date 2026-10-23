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
