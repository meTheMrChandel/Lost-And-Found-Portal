"""
matching/urls.py — URL routing for the matching engine.
"""

from django.urls import path
from apps.matching.views import (
    AdminMatchActionView,
    AdminMatchDetailView,
    AdminMatchListView,
    AdminRunMatchingView,
    MyPostMatchesView,
)

urlpatterns = [
    # Admin Match Queue & Control
    path("", AdminMatchListView.as_view(), name="admin-matches-list"),
    path("run/", AdminRunMatchingView.as_view(), name="admin-matches-run"),
    path("<uuid:pk>/", AdminMatchDetailView.as_view(), name="admin-match-detail"),
    path("<uuid:pk>/action/", AdminMatchActionView.as_view(), name="admin-match-action"),

    # Student View
    path("my-matches/", MyPostMatchesView.as_view(), name="my-post-matches"),
]
