"""
posts/urls.py — URL routes for item categories, lost post reporting, and user reports.
"""

from django.urls import path
from apps.posts.views import (
    CategoryListView,
    FoundPostCreateView,
    LostPostCreateView,
    LostPostDetailView,
    MyReportsListView,
    PostPublicDetailView,
    PostRenewView,
    PostReportAbuseView,
    PublicFeedView,
)

urlpatterns = [
    # Public Feed (Phase 5)
    path("", PublicFeedView.as_view(), name="post-feed-root"),
    path("feed/", PublicFeedView.as_view(), name="post-feed"),

    # Item categories
    path("categories/", CategoryListView.as_view(), name="category-list"),

    # Lost posts endpoints (User 1 flow)
    path("lost/", LostPostCreateView.as_view(), name="lost-post-create"),
    path("lost/my-reports/", MyReportsListView.as_view(), name="lost-my-reports"),
    path("lost/<uuid:pk>/", LostPostDetailView.as_view(), name="lost-post-detail"),

    # Found posts endpoints (User 2 flow - Phase 5)
    path("found/", FoundPostCreateView.as_view(), name="found-post-create"),

    # General user posts & item details
    path("my/", MyReportsListView.as_view(), name="my-posts"),
    path("<uuid:pk>/", PostPublicDetailView.as_view(), name="post-public-detail"),
    path("<uuid:pk>/report-abuse/", PostReportAbuseView.as_view(), name="post-report-abuse"),
    path("<uuid:pk>/renew/", PostRenewView.as_view(), name="post-renew"),
]
