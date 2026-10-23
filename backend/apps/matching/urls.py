"""
matching/urls.py — URL routing for the matching engine.
"""

from django.urls import path
from apps.matching.views import (
    AdminGenerateHandoverCodeView,
    AdminMatchActionView,
    AdminMatchCloseView,
    AdminMatchDetailView,
    AdminMatchListView,
    AdminMatchProofRecordView,
    AdminRunMatchingView,
    AdminVerifyHandoverCodeView,
    MatchMeetingModeView,
    MyPostMatchesView,
)

urlpatterns = [
    # Admin Match Queue & Control
    path("", AdminMatchListView.as_view(), name="admin-matches-list"),
    path("run/", AdminRunMatchingView.as_view(), name="admin-matches-run"),
    path("<uuid:pk>/", AdminMatchDetailView.as_view(), name="admin-match-detail"),
    path("<uuid:pk>/action/", AdminMatchActionView.as_view(), name="admin-match-action"),

    # Phase 6: Verification & Handover
    path("<uuid:pk>/proof/", AdminMatchProofRecordView.as_view(), name="admin-match-proof"),
    path("<uuid:pk>/meeting-mode/", MatchMeetingModeView.as_view(), name="match-meeting-mode"),
    path("<uuid:pk>/handover-code/generate/", AdminGenerateHandoverCodeView.as_view(), name="admin-match-handover-generate"),
    path("<uuid:pk>/handover-code/verify/", AdminVerifyHandoverCodeView.as_view(), name="admin-match-handover-verify"),
    path("<uuid:pk>/close/", AdminMatchCloseView.as_view(), name="admin-match-close"),

    # Student View
    path("my-matches/", MyPostMatchesView.as_view(), name="my-post-matches"),
]
