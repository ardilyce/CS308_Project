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

    # customer context for agents
    path(
        "conversations/<int:conversation_id>/context/",
        views.customer_context,
        name="support-customer-context",
    ),

    # staff/admin queue + actions
    path("agent/queue/", views.AgentQueueView.as_view(), name="support-agent-queue"),
    path(
        "agent/conversations/active/",
        views.AgentActiveConversationsView.as_view(),
        name="support-agent-active",
    ),
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
    # support agent order detail
    path(
        "agent/orders/<int:order_id>/",
        views.support_agent_order_detail,
        name="support-agent-order-detail",
    ),
    # support agent invoice html
    path(
        "agent/orders/<int:order_id>/invoice/",
        views.support_agent_invoice_html,
        name="support-agent-invoice-html",
    ),
    # download attachment
    path(
        "messages/<int:message_id>/attachment/",
        views.download_attachment,
        name="support-download-attachment",
    ),
]


