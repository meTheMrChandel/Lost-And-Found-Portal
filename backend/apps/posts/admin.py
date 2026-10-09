"""posts/admin.py — Django admin for posts app."""

from django.contrib import admin
from django.utils.html import format_html

from .models import AbuseReport, Category, Post, PostImage, SiteSettings


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("slug", "name", "icon", "is_sensitive", "order")
    list_editable = ("order", "is_sensitive")
    ordering = ("order",)


@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    list_display = ("match_threshold", "post_expiry_days", "otp_expiry_seconds", "updated_at")

    def has_add_permission(self, request):
        return not SiteSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


class PostImageInline(admin.TabularInline):
    model = PostImage
    extra = 0
    readonly_fields = ("thumbnail_preview",)

    def thumbnail_preview(self, obj):
        if obj.image:
            return format_html('<img src="{}" height="60"/>', obj.image.url)
        return "-"
    thumbnail_preview.short_description = "Preview"


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("title", "post_type", "category", "status", "author", "created_at", "expires_at")
    list_filter = ("post_type", "status", "category")
    search_fields = ("title", "author__email", "author__registration_number")
    readonly_fields = ("id", "created_at", "updated_at", "expires_at")
    inlines = [PostImageInline]
    date_hierarchy = "created_at"

    fieldsets = (
        ("Content", {"fields": ("id", "post_type", "category", "title", "description", "last_seen_place", "last_seen_time")}),
        ("Hidden Proof & Reward", {"fields": ("hidden_proof", "reward_amount"), "classes": ("collapse",)}),
        ("Found Info", {"fields": ("custody_location", "inform_admin_privately"), "classes": ("collapse",)}),
        ("Status", {"fields": ("status", "admin_remarks", "reviewed_by", "reviewed_at")}),
        ("Lifecycle", {"fields": ("created_at", "updated_at", "expires_at", "renewed_at")}),
    )


@admin.register(AbuseReport)
class AbuseReportAdmin(admin.ModelAdmin):
    list_display = ("post", "reporter", "reason", "is_resolved", "created_at")
    list_filter = ("reason", "is_resolved")
    search_fields = ("post__title", "reporter__email")
