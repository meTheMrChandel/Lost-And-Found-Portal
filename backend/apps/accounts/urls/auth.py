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
    PasswordResetConfirmView,
)
from apps.accounts.views.users import UserProfileView

urlpatterns = [
    path("request-otp/", RequestOTPView.as_view(), name="request-otp"),
    path("verify-otp/", VerifyOTPView.as_view(), name="verify-otp"),
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh-alias"),
    path("me/", UserProfileView.as_view(), name="auth-me"),
    path("profile/", UserProfileView.as_view(), name="auth-profile"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("password-reset/", PasswordResetConfirmView.as_view(), name="password-reset-alias"),
    path("password-reset-confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
]



