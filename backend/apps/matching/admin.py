from django.contrib import admin
from .models import Match, MatchAuditLog

@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ('lost_post', 'found_post', 'score', 'status', 'created_at')
    list_filter = ('status',)
    readonly_fields = ('id', 'created_at', 'updated_at')

@admin.register(MatchAuditLog)
class MatchAuditLogAdmin(admin.ModelAdmin):
    list_display = ('match', 'admin', 'action', 'from_status', 'to_status', 'created_at')
    readonly_fields = ('id', 'created_at')
