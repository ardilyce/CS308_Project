import logging
from django.utils import timezone
from django.conf import settings
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from django.db.models import Q
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from .models import Conversation, Message
from .serializers import ConversationSerializer, MessageSerializer, CustomerContextSerializer

logger = logging.getLogger(__name__)


def broadcast_message_to_websocket(message, request=None):
    """
    Broadcast a message to all WebSocket clients in the conversation group.
    This ensures messages sent via REST API (like attachments) appear in real-time.
    """
    try:
        channel_layer = get_channel_layer()
        if channel_layer is None:
            logger.warning("Channel layer not configured, skipping WebSocket broadcast")
            return

        conversation_group_name = f"chat_{message.conversation_id}"

        # Get sender name
        if message.sender:
            sender_name = message.sender.get_full_name() or message.sender.username
        else:
            sender_name = message.guest_sender_name or "Guest"

        # Build attachment URL
        attachment_url = None
        if message.attachment:
            attachment_url = message.attachment.url

        # Broadcast to the conversation group
        async_to_sync(channel_layer.group_send)(
            conversation_group_name,
            {
                "type": "chat_message",
                "message": {
                    "id": message.id,
                    "text": message.text,
                    "attachment_url": attachment_url,
                    "is_from_agent": message.is_from_agent,
                    "sender_name": sender_name,
                    "created_at": message.created_at.isoformat(),
                }
            }
        )
    except Exception as e:
        logger.error(f"Failed to broadcast message via WebSocket: {e}")


class IsSupportAgentOrAdmin(permissions.BasePermission):
    """
    Custom permission to allow access to support agents and admins.
    Checks for is_staff OR support_agent role in UserProfile.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Admin users always have access
        if request.user.is_staff:
            return True
        
        # Check for support_agent role in profile
        try:
            profile = request.user.profile
            return profile.role == 'support_agent'
        except Exception:
            return False


def _is_owner_or_staff(request, conv: Conversation) -> bool:
    """Check if request user has access to this conversation"""
    
    # Guest users - check guest token
    if not request.user.is_authenticated:
        token = request.headers.get("X-GUEST-TOKEN", "")
        return bool(token) and token == (conv.guest_token or "")
    
    # Authenticated users
    user = request.user
    
    # Admin/staff users can see all conversations
    if user.is_staff:
        return True
    
    # Support agents can see all conversations
    try:
        if hasattr(user, 'profile') and user.profile.role == 'support_agent':
            return True
    except Exception:
        # Profile doesn't exist or error accessing it
        pass
    
    # Regular customers can only see their own conversations
    if conv.customer_id == user.id:
        return True
    
    return False


class CreateConversationView(generics.CreateAPIView):
    serializer_class = ConversationSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        """
        Create a new conversation OR return an existing active/queued conversation
        for the current user/guest. This ensures each user has their own isolated chat.
        """
        import secrets
        user = request.user if request.user.is_authenticated else None
        guest_token = request.data.get("guest_token", "")

        # Try to find an existing non-closed conversation for this user/guest
        existing_conv = None

        if user:
            # For authenticated users, find their existing active/queued conversation
            existing_conv = Conversation.objects.filter(
                customer=user,
                status__in=[Conversation.Status.QUEUED, Conversation.Status.ACTIVE]
            ).order_by("-updated_at").first()
        elif guest_token:
            # For guests, find existing conversation by guest_token
            existing_conv = Conversation.objects.filter(
                guest_token=guest_token,
                status__in=[Conversation.Status.QUEUED, Conversation.Status.ACTIVE]
            ).order_by("-updated_at").first()

        if existing_conv:
            # Return existing conversation
            serializer = self.get_serializer(existing_conv)
            return Response(serializer.data, status=status.HTTP_200_OK)

        # No existing conversation, create a new one
        if not user and not guest_token:
            guest_token = secrets.token_urlsafe(32)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(customer=user, guest_token=guest_token)

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context


class ConversationDetailView(generics.RetrieveAPIView):
    queryset = Conversation.objects.all()
    serializer_class = ConversationSerializer
    permission_classes = [permissions.AllowAny]

    def retrieve(self, request, *args, **kwargs):
        conv = self.get_object()
        if not _is_owner_or_staff(request, conv):
            return Response({"detail": "Forbidden"}, status=403)
        serializer = self.get_serializer(conv)
        return Response(serializer.data)
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context


class ConversationMessagesView(generics.ListCreateAPIView):
    serializer_class = MessageSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        conv_id = self.kwargs["conversation_id"]
        conv = Conversation.objects.filter(id=conv_id).first()
        if not conv:
            return Message.objects.none()

        if not _is_owner_or_staff(self.request, conv):
            return Message.objects.none()

        return Message.objects.filter(conversation_id=conv_id).order_by("created_at")
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def create(self, request, *args, **kwargs):
        conv_id = self.kwargs["conversation_id"]
        conv = Conversation.objects.filter(id=conv_id).first()
        if not conv:
            return Response({"detail": "Conversation not found"}, status=404)

        if not _is_owner_or_staff(request, conv):
            return Response({"detail": "Forbidden"}, status=403)

        # Check if conversation is closed
        if conv.status == Conversation.Status.CLOSED:
            return Response(
                {"detail": "This ticket is closed. Please refresh the page to open a new conversation."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Handle file upload
        attachment = request.FILES.get("attachment")
        text = request.data.get("text", "")
        guest_sender_name = request.data.get("guest_sender_name", "")

        # Validate file if provided
        if attachment:
            # Check file size (max 10MB)
            max_size = 10 * 1024 * 1024  # 10MB
            if attachment.size > max_size:
                return Response(
                    {"detail": "File size exceeds 10MB limit"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Check file type
            allowed_types = [
                "application/pdf",
                "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
                "video/mp4", "video/mpeg", "video/quicktime",
            ]
            if attachment.content_type not in allowed_types:
                return Response(
                    {"detail": "File type not allowed. Allowed: PDF, images, videos"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Create message
        if request.user.is_authenticated:
            # Check if user is staff or has support_agent role
            is_agent = request.user.is_staff
            if not is_agent:
                try:
                    if hasattr(request.user, 'profile'):
                        is_agent = request.user.profile.role == 'support_agent'
                except Exception:
                    pass
            msg = Message.objects.create(
                conversation=conv,
                sender=request.user,
                is_from_agent=is_agent,
                text=text,
                attachment=attachment,
            )
        else:
            msg = Message.objects.create(
                conversation=conv,
                sender=None,
                guest_sender_name=guest_sender_name or conv.guest_name or "Guest",
                is_from_agent=False,
                text=text,
                attachment=attachment,
            )

        # Update conversation updated_at
        conv.save(update_fields=["updated_at"])

        # Broadcast message to WebSocket clients for real-time updates
        broadcast_message_to_websocket(msg, request)

        serializer = MessageSerializer(msg, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


# --- Agent queue endpoints ---
class AgentQueueView(generics.ListAPIView):
    serializer_class = ConversationSerializer
    permission_classes = [IsSupportAgentOrAdmin]

    def get_queryset(self):
        return Conversation.objects.filter(status=Conversation.Status.QUEUED).order_by("created_at")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context


@api_view(["POST"])
@permission_classes([IsSupportAgentOrAdmin])
def claim_conversation(request, conversation_id: int):
    conv = Conversation.objects.filter(id=conversation_id).first()
    if not conv:
        return Response({"detail": "Conversation not found"}, status=404)

    if conv.claimed_by_id and conv.claimed_by_id != request.user.id:
        return Response({"detail": "Already claimed"}, status=409)

    conv.claimed_by = request.user
    conv.claimed_at = timezone.now()
    conv.status = Conversation.Status.ACTIVE
    conv.save(update_fields=["claimed_by", "claimed_at", "status", "updated_at"])
    return Response(ConversationSerializer(conv, context={"request": request}).data, status=200)


@api_view(["POST"])
@permission_classes([IsSupportAgentOrAdmin])
def close_conversation(request, conversation_id: int):
    conv = Conversation.objects.filter(id=conversation_id).first()
    if not conv:
        return Response({"detail": "Conversation not found"}, status=404)

    conv.status = Conversation.Status.CLOSED
    conv.save(update_fields=["status", "updated_at"])
    
    # Broadcast ticket_closed message to all connected WebSocket clients
    try:
        channel_layer = get_channel_layer()
        if channel_layer:
            conversation_group_name = f"chat_{conversation_id}"
            async_to_sync(channel_layer.group_send)(
                conversation_group_name,
                {
                    "type": "ticket_closed",
                    "message": "This ticket is closed. Please refresh the page to open a new conversation."
                }
            )
    except Exception as e:
        logger.error(f"Failed to broadcast ticket_closed via WebSocket: {e}")
    
    return Response(ConversationSerializer(conv, context={"request": request}).data, status=200)


class AgentActiveConversationsView(generics.ListAPIView):
    """Get active conversations claimed by current agent"""
    serializer_class = ConversationSerializer
    permission_classes = [IsSupportAgentOrAdmin]

    def get_queryset(self):
        return (
            Conversation.objects.filter(
                status=Conversation.Status.ACTIVE,
                claimed_by=self.request.user
            )
            .order_by("-updated_at")
            .prefetch_related("messages")
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context


@api_view(["GET"])
@permission_classes([IsSupportAgentOrAdmin])
def customer_context(request, conversation_id: int):
    """Get customer context (cart, orders, wishlist) for a conversation"""
    try:
        conv = Conversation.objects.get(id=conversation_id)
    except Conversation.DoesNotExist:
        return Response({"detail": "Conversation not found"}, status=404)

    # Only works for logged-in customers
    if not conv.customer:
        return Response({
            "cart_items": [],
            "orders": [],
            "wishlist": [],
            "message": "Guest user - no context available"
        })

    customer = conv.customer
    context_data = {
        "cart_items": [],
        "orders": [],
        "wishlist": [],
    }

    # Get cart items
    try:
        from cart.models import Cart
        cart = Cart.objects.get(user=customer)
        from catalog.models import ScrapedProduct as Product

        # Enrich cart items with product details
        product_ids = [item.get("id") for item in cart.items if item.get("id")]
        products = Product.objects.filter(id__in=product_ids, is_active=True)
        product_map = {p.id: p for p in products}

        context_data["cart_items"] = [
            {
                "id": item.get("id"),
                "quantity": item.get("qty", 1),
                "product_name": product_map.get(item.get("id"), {}).name if item.get("id") in product_map else "Product not found",
                "product_price": float(product_map.get(item.get("id"), {}).discounted_price) if item.get("id") in product_map else 0,
            }
            for item in cart.items
            if item.get("id") in product_map
        ]
    except Exception as e:
        logger.warning(f"Failed to fetch cart for customer {customer.id}: {e}")

    # Get orders
    try:
        from orders.models import Order
        orders = Order.objects.filter(customer=customer).order_by("-created_at")[:10]
        context_data["orders"] = [
            {
                "id": order.id,
                "status": order.status,
                "payment_status": order.payment_status,
                "total_amount": float(order.total_amount),
                "created_at": order.created_at.isoformat(),
            }
            for order in orders
        ]
    except Exception as e:
        logger.warning(f"Failed to fetch orders for customer {customer.id}: {e}")

    # Get wishlist
    try:
        from catalog.models import Wishlist
        wishlist = Wishlist.objects.get(user=customer)
        from catalog.models import ScrapedProduct as Product

        # Get product names for wishlist items
        products = Product.objects.filter(id__in=wishlist.product_ids, is_active=True)
        context_data["wishlist"] = [
            {
                "id": p.id,
                "name": p.name,
                "price": float(p.discounted_price),
            }
            for p in products
        ]
    except Exception as e:
        logger.warning(f"Failed to fetch wishlist for customer {customer.id}: {e}")

    serializer = CustomerContextSerializer(context_data)
    return Response(serializer.data, status=200)

