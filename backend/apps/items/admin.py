from django.contrib import admin
from .models import RegisteredItem

@admin.register(RegisteredItem)
class RegisteredItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'owner', 'category', 'is_active', 'qr_uuid', 'created_at')
    list_filter = ('category', 'is_active')
    readonly_fields = ('id', 'qr_uuid', 'created_at', 'updated_at')
