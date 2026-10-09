from django.contrib import admin
from .models import PostAuditLog, AdminInvite

@admin.register(PostAuditLog)
class PostAuditLogAdmin(admin.ModelAdmin):
    list_display = ('post', 'admin', 'action', 'previous_status', 'new_status', 'created_at')
    readonly_fields = ('id', 'created_at')

@admin.register(AdminInvite)
class AdminInviteAdmin(admin.ModelAdmin):
    list_display = ('email', 'invited_by', 'is_used', 'expires_at', 'created_at')
    readonly_fields = ('id', 'token', 'created_at')
