from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone

from .models import Conversation, Message

User = get_user_model()


class SupportModelsTest(TestCase):
    def test_conversation_defaults(self):
        conv = Conversation.objects.create()
        self.assertEqual(conv.status, Conversation.Status.QUEUED)
        self.assertIsNone(conv.customer)
        self.assertIsNone(conv.claimed_by)
        self.assertIsNone(conv.claimed_at)
        self.assertEqual(conv.guest_name, "")
        self.assertEqual(conv.guest_email, "")
        self.assertEqual(conv.guest_token, "")

    def test_guest_conversation_fields(self):
        conv = Conversation.objects.create(
            guest_name="Guest",
            guest_email="guest@example.com",
            guest_token="abc123",
        )
        self.assertIsNone(conv.customer)
        self.assertEqual(conv.guest_name, "Guest")
        self.assertEqual(conv.guest_email, "guest@example.com")
        self.assertEqual(conv.guest_token, "abc123")

    def test_customer_conversation(self):
        customer = User.objects.create_user(username="c1", password="pass123")
        conv = Conversation.objects.create(customer=customer)
        self.assertEqual(conv.customer, customer)
        # guest alanları default
        self.assertEqual(conv.guest_email, "")

    def test_claim_conversation(self):
        agent = User.objects.create_user(username="agent1", password="pass123", is_staff=True)

        conv = Conversation.objects.create(
            guest_name="Guest",
            guest_email="guest@example.com",
        )

        conv.claimed_by = agent
        conv.claimed_at = timezone.now()
        conv.status = Conversation.Status.ACTIVE
        conv.save()

        conv.refresh_from_db()
        self.assertEqual(conv.claimed_by, agent)
        self.assertIsNotNone(conv.claimed_at)
        self.assertEqual(conv.status, Conversation.Status.ACTIVE)

    def test_message_defaults_and_links(self):
        conv = Conversation.objects.create(
            guest_name="Guest",
            guest_email="guest@example.com",
        )

        msg = Message.objects.create(
            conversation=conv,
            text="Merhaba",
            guest_sender_name="Guest",
            is_from_agent=False,
        )

        self.assertEqual(msg.conversation_id, conv.id)
        self.assertEqual(msg.text, "Merhaba")
        self.assertEqual(msg.guest_sender_name, "Guest")
        self.assertFalse(msg.is_from_agent)
        self.assertIsNone(msg.sender)  # guest message

    def test_agent_message(self):
        agent = User.objects.create_user(username="agent2", password="pass123", is_staff=True)
        conv = Conversation.objects.create(
            guest_name="Guest",
            guest_email="guest@example.com",
            status=Conversation.Status.ACTIVE,
        )

        msg = Message.objects.create(
            conversation=conv,
            sender=agent,
            is_from_agent=True,
            text="Size yardımcı oluyorum.",
        )

        self.assertEqual(msg.sender, agent)
        self.assertTrue(msg.is_from_agent)
        self.assertEqual(msg.text, "Size yardımcı oluyorum.")
        self.assertEqual(msg.guest_sender_name, "")  # default

    def test_conversation_delete_cascades_messages(self):
        conv = Conversation.objects.create(guest_email="guest@example.com")
        Message.objects.create(conversation=conv, text="1")
        Message.objects.create(conversation=conv, text="2")

        self.assertEqual(Message.objects.count(), 2)
        conv.delete()
        self.assertEqual(Message.objects.count(), 0)

