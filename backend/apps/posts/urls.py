"""
posts/urls.py — URL routes for item categories, lost post reporting, and user reports.
"""

from django.urls import path
from apps.posts.views import (
    CategoryListView,
    LostPostCreateView,
    LostPostDetailView,
    MyReportsListView,
)

urlpatterns = [
    # Item categories
    path("categories/", CategoryListView.as_view(), name="category-list"),

    # Lost posts endpoints (User 1 flow)
    path("lost/", LostPostCreateView.as_view(), name="lost-post-create"),
    path("lost/my-reports/", MyReportsListView.as_view(), name="lost-my-reports"),
    path("lost/<uuid:pk>/", LostPostDetailView.as_view(), name="lost-post-detail"),

    # General user posts
    path("my/", MyReportsListView.as_view(), name="my-posts"),
]
