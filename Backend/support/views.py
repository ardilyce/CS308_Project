from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes

from .models import Conversation, Message
from .serializers import ConversationSerializer, MessageSerializer


def _is_owner_or_staff(request, conv: Conversation) -> bool:
    # staff/admin can see all
    if request.user.is_authenticated and request.user.is_staff:
        return True

    # logged-in customer: must match
    if request.user.is_authenticated:
        return conv.customer_id == request.user.id

    # guest: must present token
    token = request.headers.get("X-GUEST-TOKEN", "")
    return bool(token) and token == (conv.guest_token or "")


class CreateConversationView(generics.CreateAPIView):
    serializer_class = ConversationSerializer
    permission_classes = [permissions.AllowAny]

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(customer=user)


class ConversationDetailView(generics.RetrieveAPIView):
    queryset = Conversation.objects.all()
    serializer_class = ConversationSerializer
    permission_classes = [permissions.AllowAny]

    def retrieve(self, request, *args, **kwargs):
        conv = self.get_object()
        if not _is_owner_or_staff(request, conv):
            return Response({"detail": "Forbidden"}, status=403)
        return super().retrieve(request, *args, **kwargs)


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

    def create(self, request, *args, **kwargs):
        conv_id = self.kwargs["conversation_id"]
        conv = Conversation.objects.filter(id=conv_id).first()
        if not conv:
            return Response({"detail": "Conversation not found"}, status=404)

        if not _is_owner_or_staff(request, conv):
            return Response({"detail": "Forbidden"}, status=403)

        data = request.data.copy()
        data["conversation"] = conv_id

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)

        if request.user.is_authenticated:
            is_agent = request.user.is_staff
            msg = serializer.save(sender=request.user, is_from_agent=is_agent)
        else:
            # optional: allow guest to provide a name
            msg = serializer.save(sender=None, is_from_agent=False)

        return Response(MessageSerializer(msg).data, status=status.HTTP_201_CREATED)


# --- Agent queue endpoints ---
class AgentQueueView(generics.ListAPIView):
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        return Conversation.objects.filter(status="queued").order_by("created_at")


@api_view(["POST"])
@permission_classes([permissions.IsAdminUser])
def claim_conversation(request, conversation_id: int):
    conv = Conversation.objects.filter(id=conversation_id).first()
    if not conv:
        return Response({"detail": "Conversation not found"}, status=404)

    if conv.claimed_by_id and conv.claimed_by_id != request.user.id:
        return Response({"detail": "Already claimed"}, status=409)

    conv.claimed_by = request.user
    conv.claimed_at = timezone.now()
    conv.status = "active"
    conv.save(update_fields=["claimed_by", "claimed_at", "status", "updated_at"])
    return Response(ConversationSerializer(conv).data, status=200)


@api_view(["POST"])
@permission_classes([permissions.IsAdminUser])
def close_conversation(request, conversation_id: int):
    conv = Conversation.objects.filter(id=conversation_id).first()
    if not conv:
        return Response({"detail": "Conversation not found"}, status=404)

    conv.status = "closed"
    conv.save(update_fields=["status", "updated_at"])
    return Response(ConversationSerializer(conv).data, status=200)


