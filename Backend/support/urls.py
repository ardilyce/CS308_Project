from django.urls import path
from . import views

urlpatterns = [
    # customer/guest creates a conversation
    path("conversations/", views.CreateConversationView.as_view(), name="support-create"),

    # get a conversation (owner/staff rules will be in views)
    path("conversations/<int:pk>/", views.ConversationDetailView.as_view(), name="support-detail"),

    # list/create messages in a conversation
    path(
        "conversations/<int:conversation_id>/messages/",
        views.ConversationMessagesView.as_view(),
        name="support-messages",
    ),

    # staff/admin queue + actions
    path("agent/queue/", views.AgentQueueView.as_view(), name="support-agent-queue"),
    path(
        "agent/conversations/<int:conversation_id>/claim/",
        views.claim_conversation,
        name="support-claim",
    ),
    path(
        "agent/conversations/<int:conversation_id>/close/",
        views.close_conversation,
        name="support-close",
    ),
]


