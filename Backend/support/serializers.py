from rest_framework import serializers
from .models import Conversation, Message


class ConversationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Conversation
        fields = [
            "id",
            "customer",
            "guest_name",
            "guest_email",
            "guest_token",
            "status",
            "claimed_by",
            "claimed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "customer", "claimed_by", "claimed_at", "created_at", "updated_at"]


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = [
            "id",
            "conversation",
            "sender",
            "guest_sender_name",
            "is_from_agent",
            "text",
            "attachment",
            "created_at",
        ]
        read_only_fields = ["id", "sender", "is_from_agent", "created_at"]
