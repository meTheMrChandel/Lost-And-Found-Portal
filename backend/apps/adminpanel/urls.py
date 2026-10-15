"""
adminpanel/urls.py — Admin Panel and Staff endpoints.
"""

from django.urls import path
from apps.adminpanel.views.invites import AcceptAdminInviteView, AdminInviteListCreateView
from apps.adminpanel.views.users import AdminUserListView, AdminUserModerationView
from apps.adminpanel.views.audit import PostAuditLogListView

urlpatterns = [
    path("invites/", AdminInviteListCreateView.as_view(), name="admin-invites-list-create"),
    path("invites/accept/", AcceptAdminInviteView.as_view(), name="admin-invites-accept"),
    path("users/", AdminUserListView.as_view(), name="admin-users-list"),
    path("users/<uuid:user_id>/moderate/", AdminUserModerationView.as_view(), name="admin-users-moderate"),
    path("audit-logs/", PostAuditLogListView.as_view(), name="admin-audit-logs-list"),
]
