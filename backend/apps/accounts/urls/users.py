"""
accounts/urls/users.py — User management endpoints.
"""

from django.urls import path
from apps.accounts.views.users import RegisterDeviceTokenView, UserProfileView

urlpatterns = [
    path("me/", UserProfileView.as_view(), name="user-me"),
    path("device-token/", RegisterDeviceTokenView.as_view(), name="user-device-token"),
]
