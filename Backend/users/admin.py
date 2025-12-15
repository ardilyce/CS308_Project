from django.contrib import admin
from .models import UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "role", "tax_id", "home_address", "created_at")
    list_filter = ("role", "created_at")
    search_fields = ("user__username", "user__email", "tax_id")
    readonly_fields = ("created_at", "updated_at")
    
    fieldsets = (
        (None, {
            "fields": ("user", "role")
        }),
        ("Customer Information", {
            "fields": ("tax_id", "home_address", "card_number"),
            "classes": ("collapse",),
            "description": "These fields are primarily used for customers."
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )

