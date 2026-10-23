"""
adminpanel/urls.py — Admin Panel and Staff endpoints.
"""

from django.urls import path
from apps.adminpanel.views.invites import AcceptAdminInviteView, AdminInviteListCreateView
from apps.adminpanel.views.users import AdminUserListView, AdminUserModerationView
from apps.adminpanel.views.audit import PostAuditLogListView
from apps.adminpanel.views.settings import AdminSiteSettingsView
from apps.adminpanel.views.cases import (
    AdminPostDetailView,
    AdminPostQueueView,
    AdminPostReviewView,
)
from apps.adminpanel.views.abuse import (
    AdminAbuseReportListView,
    AdminAbuseReportResolveView,
)
from apps.adminpanel.views.stats import AdminStatisticsView
from apps.matching.views import (
    AdminMatchActionView,
    AdminMatchDetailView,
    AdminMatchListView,
    AdminRunMatchingView,
)

urlpatterns = [
    # Invites & User Moderation
    path("invites/", AdminInviteListCreateView.as_view(), name="admin-invites-list-create"),
    path("invites/accept/", AcceptAdminInviteView.as_view(), name="admin-invites-accept"),
    path("users/", AdminUserListView.as_view(), name="admin-users-list"),
    path("users/<uuid:user_id>/moderate/", AdminUserModerationView.as_view(), name="admin-users-moderate"),

    # Case Queue & Review Actions (Phase 4)
    path("posts/", AdminPostQueueView.as_view(), name="admin-posts-queue"),
    path("posts/<uuid:pk>/", AdminPostDetailView.as_view(), name="admin-post-detail"),
    path("posts/<uuid:pk>/review/", AdminPostReviewView.as_view(), name="admin-post-review"),

    # Match Queue & Control
    path("matches/", AdminMatchListView.as_view(), name="admin-panel-matches-list"),
    path("matches/run/", AdminRunMatchingView.as_view(), name="admin-panel-matches-run"),
    path("matches/<uuid:pk>/", AdminMatchDetailView.as_view(), name="admin-panel-match-detail"),
    path("matches/<uuid:pk>/action/", AdminMatchActionView.as_view(), name="admin-panel-match-action"),

    # Abuse Reports (Phase 4)
    path("abuse-reports/", AdminAbuseReportListView.as_view(), name="admin-abuse-reports-list"),
    path("abuse-reports/<uuid:pk>/resolve/", AdminAbuseReportResolveView.as_view(), name="admin-abuse-reports-resolve"),

    # Statistics & Audit
    path("statistics/", AdminStatisticsView.as_view(), name="admin-statistics"),
    path("audit-logs/", PostAuditLogListView.as_view(), name="admin-audit-logs-list"),
    path("settings/", AdminSiteSettingsView.as_view(), name="admin-site-settings"),
]
