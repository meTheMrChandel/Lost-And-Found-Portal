"""
accounts/urls/auth.py — Authentication endpoints.
"""

from django.urls import path
from apps.accounts.views.auth import (
    RequestOTPView,
    VerifyOTPView,
    RegisterView,
    LoginView,
    LogoutView,
    TokenRefreshView,
)

urlpatterns = [
    path("request-otp/", RequestOTPView.as_view(), name="request-otp"),
    path("verify-otp/", VerifyOTPView.as_view(), name="verify-otp"),
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
]


