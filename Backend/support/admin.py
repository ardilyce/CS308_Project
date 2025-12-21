from django.contrib import admin
from .models import Conversation, Message


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("id", "status", "customer", "guest_email", "claimed_by", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("customer__username", "guest_email", "guest_name")


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("id", "conversation", "sender", "is_from_agent", "created_at")
    list_filter = ("is_from_agent", "created_at")
    search_fields = ("conversation__id", "sender__username", "text")

