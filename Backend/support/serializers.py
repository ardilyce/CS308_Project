from rest_framework import serializers
from django.conf import settings
from .models import Conversation, Message


class ConversationSerializer(serializers.ModelSerializer):
    unread_count = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()
    customer_username = serializers.SerializerMethodField()
    customer_email = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            "id",
            "customer",
            "customer_name",
            "customer_username",
            "customer_email",
            "guest_name",
            "guest_email",
            "guest_token",
            "status",
            "claimed_by",
            "claimed_at",
            "created_at",
            "updated_at",
            "unread_count",
            "last_message",
        ]
        read_only_fields = ["id", "customer", "claimed_by", "claimed_at", "created_at", "updated_at", "unread_count", "last_message", "customer_name", "customer_username", "customer_email"]

    def get_unread_count(self, obj):
        # Count unread messages (messages not from current user)
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return 0

        # Check if user is staff or support agent
        is_agent = request.user.is_staff
        if not is_agent:
            try:
                if hasattr(request.user, 'profile'):
                    is_agent = request.user.profile.role == 'support_agent'
            except Exception:
                pass

        # For agents, count customer messages; for customers, count agent messages
        if is_agent:
            return obj.messages.filter(is_from_agent=False).count()
        else:
            return obj.messages.filter(is_from_agent=True).count()

    def get_last_message(self, obj):
        last_msg = obj.messages.order_by("-created_at").first()
        if last_msg:
            return {
                "text": last_msg.text[:100] if last_msg.text else "",
                "created_at": last_msg.created_at.isoformat(),
            }
        return None

    def get_customer_name(self, obj):
        if obj.customer:
            return obj.customer.get_full_name() or obj.customer.username
        return None

    def get_customer_username(self, obj):
        if obj.customer:
            return obj.customer.username
        return None

    def get_customer_email(self, obj):
        if obj.customer:
            return obj.customer.email
        return None


class MessageSerializer(serializers.ModelSerializer):
    attachment_url = serializers.SerializerMethodField()
    sender_name = serializers.SerializerMethodField()

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
            "attachment_url",
            "sender_name",
            "created_at",
        ]
        read_only_fields = ["id", "sender", "is_from_agent", "created_at", "attachment_url", "sender_name"]

    def get_attachment_url(self, obj):
        if obj.attachment:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.attachment.url)
            return obj.attachment.url
        return None

    def get_sender_name(self, obj):
        if obj.sender:
            return obj.sender.get_full_name() or obj.sender.username
        return obj.guest_sender_name or "Guest"


class CustomerContextSerializer(serializers.Serializer):
    """Serializer for customer context data shown to agents"""
    cart_items = serializers.ListField()
    orders = serializers.ListField()
    wishlist = serializers.ListField()
