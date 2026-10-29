from django.contrib import admin
from .models import PostAuditLog, AdminInvite

@admin.register(PostAuditLog)
class PostAuditLogAdmin(admin.ModelAdmin):
    list_display = ('post_title', 'admin', 'action', 'previous_status', 'new_status', 'created_at')
    readonly_fields = ('id', 'created_at')

    # The audit log is append-only: readable here, never added, edited or deleted
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

@admin.register(AdminInvite)
class AdminInviteAdmin(admin.ModelAdmin):
    list_display = ('email', 'invited_by', 'is_used', 'expires_at', 'created_at')
    readonly_fields = ('id', 'token', 'created_at')
