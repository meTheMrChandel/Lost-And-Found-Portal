"""accounts/admin.py — Django admin configuration for accounts app."""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _

from .models import DeviceToken, OTP, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("email", "full_name", "registration_number", "department", "is_active", "is_staff", "is_email_verified")
    list_filter = ("is_active", "is_staff", "is_superuser", "is_email_verified", "is_banned", "department")
    search_fields = ("email", "full_name", "registration_number")
    ordering = ("-date_joined",)
    readonly_fields = ("id", "date_joined", "last_login")

    fieldsets = (
        (None, {"fields": ("id", "email", "password")}),
        (_("Identity"), {"fields": ("registration_number",)}),
        (_("Profile"), {"fields": ("full_name", "department", "program_year", "hostel", "phone", "photo")}),
        (_("Permissions"), {"fields": ("is_active", "is_staff", "is_superuser", "is_email_verified", "is_banned", "ban_reason", "groups", "user_permissions")}),
        (_("Dates"), {"fields": ("date_joined", "last_login")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "registration_number", "full_name", "password1", "password2"),
        }),
    )

    # email and registration_number must not be editable after creation
    def get_readonly_fields(self, request, obj=None):
        if obj:
            return self.readonly_fields + ("email", "registration_number")
        return self.readonly_fields


@admin.register(OTP)
class OTPAdmin(admin.ModelAdmin):
    list_display = ("email", "purpose", "attempts", "is_used", "is_expired", "created_at", "expires_at")
    list_filter = ("purpose", "is_used")
    search_fields = ("email",)
    readonly_fields = ("id", "created_at", "expires_at", "otp_hash")

    def is_expired(self, obj):
        return obj.is_expired()
    is_expired.boolean = True
    is_expired.short_description = "Expired?"


@admin.register(DeviceToken)
class DeviceTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "platform", "is_active", "created_at")
    list_filter = ("platform", "is_active")
    search_fields = ("user__email",)
