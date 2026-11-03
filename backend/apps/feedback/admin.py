from django.contrib import admin

from .models import Feedback


@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    list_display = ("rating", "short_message", "page", "user", "created_at")
    list_filter = ("rating",)
    search_fields = ("message", "user__email")
    readonly_fields = ("user", "rating", "message", "page", "created_at")

    @admin.display(description="message")
    def short_message(self, obj):
        return obj.message[:80]
