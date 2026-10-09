"""
accounts/urls/auth.py — Authentication endpoints.
"""

from django.urls import path
from apps.accounts.views.auth import RequestOTPView, VerifyOTPView, RegisterView

urlpatterns = [
    path("request-otp/", RequestOTPView.as_view(), name="request-otp"),
    path("verify-otp/", VerifyOTPView.as_view(), name="verify-otp"),
    path("register/", RegisterView.as_view(), name="register"),
]

