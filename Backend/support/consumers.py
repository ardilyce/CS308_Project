import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import UntypedToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from jwt import decode as jwt_decode
from django.conf import settings

from .models import Conversation, Message

User = get_user_model()


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.conversation_id = self.scope["url_route"]["kwargs"]["conversation_id"]
        self.conversation_group_name = f"chat_{self.conversation_id}"

        # Authenticate user
        user = await self.authenticate()
        if not user:
            await self.close(code=4001)  # 4001: Authentication required
            return

        # Verify user has access to this conversation
        has_access = await self.check_conversation_access(user)
        if not has_access:
            await self.close(code=4003)  # 4003: Access denied to this conversation
            return

        # Store user in scope
        self.scope["user"] = user

        # Join conversation group
        await self.channel_layer.group_add(
            self.conversation_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave conversation group
        await self.channel_layer.group_discard(
            self.conversation_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_type = data.get("type", "message")

            if message_type == "message":
                # Check if conversation is closed before processing
                is_closed = await self.is_conversation_closed()
                if is_closed:
                    await self.send(text_data=json.dumps({
                        "type": "error",
                        "message": "This ticket is closed. Please refresh the page to open a new conversation."
                    }))
                    return

                text = data.get("text", "")
                # Note: File attachments must be uploaded via REST API (multipart/form-data)
                # WebSocket only handles text messages for real-time delivery

                # Save message to database
                message = await self.save_message(text)

                # Get attachment URL (prefer Cloudinary, fall back to local)
                attachment_url = None
                if message.cloudinary_attachment_url:
                    attachment_url = message.cloudinary_attachment_url
                elif message.attachment:
                    attachment_url = message.attachment.url
                
                # Broadcast message to conversation group
                await self.channel_layer.group_send(
                    self.conversation_group_name,
                    {
                        "type": "chat_message",
                        "message": {
                            "id": message.id,
                            "text": message.text,
                            "attachment_url": attachment_url,
                            "is_from_agent": message.is_from_agent,
                            "sender_name": await self.get_sender_name(message),
                            "created_at": message.created_at.isoformat(),
                        }
                    }
                )
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                "type": "error",
                "message": "Invalid JSON"
            }))

    async def chat_message(self, event):
        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            "type": "message",
            "data": event["message"]
        }))

    async def ticket_closed(self, event):
        """Handle ticket_closed broadcast from the support agent"""
        await self.send(text_data=json.dumps({
            "type": "ticket_closed",
            "message": event.get("message", "This ticket is closed. Please refresh the page to open a new conversation.")
        }))

    @database_sync_to_async
    def is_conversation_closed(self):
        """Check if the conversation is closed"""
        try:
            conv = Conversation.objects.get(id=self.conversation_id)
            return conv.status == Conversation.Status.CLOSED
        except Conversation.DoesNotExist:
            return True  # Treat non-existent conversations as closed

    @database_sync_to_async
    def authenticate(self):
        """Authenticate user via JWT token or guest token"""
        # Try JWT authentication from query string first (WebSocket doesn't support headers easily)
        token = None
        query_string = self.scope.get("query_string", b"").decode()
        
        # Check query string for token
        if "token=" in query_string:
            token = query_string.split("token=")[1].split("&")[0]
        else:
            # Fallback to headers
            headers = dict(self.scope.get("headers", []))
            auth_header = headers.get(b"authorization", b"").decode()
            if auth_header.startswith("Bearer "):
                token = auth_header[7:]

        if token:
            try:
                # Decode JWT token
                UntypedToken(token)
                decoded_data = jwt_decode(token, settings.SECRET_KEY, algorithms=["HS256"])
                user_id = decoded_data.get("user_id")
                if user_id:
                    try:
                        return User.objects.get(id=user_id)
                    except User.DoesNotExist:
                        pass
            except (InvalidToken, TokenError, Exception):
                pass

        # Try guest token from query string
        if "guest_token=" in query_string:
            guest_token = query_string.split("guest_token=")[1].split("&")[0]
            # Return a special marker for guest users
            return {"guest_token": guest_token, "is_guest": True}

        # Return AnonymousUser if no authentication
        return AnonymousUser()

    @database_sync_to_async
    def check_conversation_access(self, user):
        """Check if user has access to this conversation"""
        try:
            conv = Conversation.objects.get(id=self.conversation_id)
        except Conversation.DoesNotExist:
            return False

        # Guest users check
        if isinstance(user, dict) and user.get("is_guest"):
            guest_token = user.get("guest_token", "")
            return bool(guest_token) and guest_token == (conv.guest_token or "")
        
        # Staff can access any conversation
        if hasattr(user, "is_staff") and user.is_staff:
            return True

        # Support agents can access any conversation
        if hasattr(user, "id") and user.id:
            try:
                profile = user.profile
                if profile.role == 'support_agent':
                    return True
            except Exception:
                pass

        # Logged-in customer must own the conversation
        if hasattr(user, "id") and user.id:
            return conv.customer_id == user.id

        return False

    @database_sync_to_async
    def save_message(self, text):
        """Save text message to database (attachments go via REST API)"""
        user = self.scope.get("user")
        conv = Conversation.objects.get(id=self.conversation_id)

        is_agent = False
        sender = None
        guest_sender_name = ""

        if isinstance(user, dict) and user.get("is_guest"):
            guest_sender_name = conv.guest_name or "Guest"
        elif hasattr(user, "id") and user.id:
            sender = user
            # Check if user is staff or has support_agent role
            is_agent = user.is_staff
            if not is_agent:
                try:
                    is_agent = user.profile.role == 'support_agent'
                except Exception:
                    pass
        else:
            guest_sender_name = "Guest"

        message = Message.objects.create(
            conversation=conv,
            sender=sender,
            guest_sender_name=guest_sender_name,
            is_from_agent=is_agent,
            text=text,
        )

        # Update conversation updated_at
        conv.save(update_fields=["updated_at"])

        return message

    @database_sync_to_async
    def get_sender_name(self, message):
        """Get sender name for message"""
        if message.sender:
            return message.sender.get_full_name() or message.sender.username
        return message.guest_sender_name or "Guest"
