from django.conf import settings
from django.db import models


class Conversation(models.Model):
    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        ACTIVE = "active", "Active"
        CLOSED = "closed", "Closed"

    # Logged-in user varsa bağlanacak, yoksa guest
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="support_conversations",
    )
    guest_name = models.CharField(max_length=120, blank=True, default="")
    guest_email = models.EmailField(blank=True, default="")
    guest_token = models.CharField(max_length=64, blank=True, default="")  # frontend localStorage vb.

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.QUEUED
    )

    claimed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="claimed_support_conversations",
    )
    claimed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        who = self.customer.username if self.customer else (self.guest_name or "guest")
        return f"Conversation #{self.id} ({who}) - {self.status}"


class Message(models.Model):
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="messages"
    )

    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="support_messages",
    )

    # guest mesajı için
    guest_sender_name = models.CharField(max_length=120, blank=True, default="")

    # Kim gönderdi bilgisi
    is_from_agent = models.BooleanField(default=False)

    text = models.TextField(blank=True, default="")
    attachment = models.FileField(upload_to="support_attachments/", null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Msg #{self.id} conv#{self.conversation_id}"

        
