"""
adminpanel/urls.py — Admin Panel and Staff endpoints.
"""

from django.urls import path
from apps.adminpanel.views.invites import AcceptAdminInviteView, AdminInviteListCreateView

urlpatterns = [
    path("invites/", AdminInviteListCreateView.as_view(), name="admin-invites-list-create"),
    path("invites/accept/", AcceptAdminInviteView.as_view(), name="admin-invites-accept"),
]
