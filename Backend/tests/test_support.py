import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APIClient

from support.models import Conversation, Message
from users.models import UserProfile
from cart.models import Cart
from catalog.models import ScrapedProduct
from orders.models import Order

User = get_user_model()
pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def customer():
    return User.objects.create_user(
        username="customer",
        email="customer@example.com",
        password="pass123",
    )


@pytest.fixture
def support_agent():
    agent = User.objects.create_user(
        username="agent",
        email="agent@example.com",
        password="agentpass",
    )
    profile = agent.profile
    profile.role = UserProfile.Role.SUPPORT_AGENT
    profile.save()
    return agent


@pytest.fixture
def sample_product():
    return ScrapedProduct.objects.create(
        name="Support Camera",
        stock=5,
        price=2500,
        warranty="2 years",
        url="https://example.com/camera",
        category="Camera",
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------
def test_agent_queue_and_claim_flow(api_client, customer, support_agent):
    """Support agent sees queued chats and can claim but conflicts are blocked."""
    conversation = Conversation.objects.create(customer=customer)

    # Unauthenticated and regular customers are blocked
    resp = api_client.get("/api/support/agent/queue/")
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    api_client.force_authenticate(user=customer)
    resp = api_client.get("/api/support/agent/queue/")
    assert resp.status_code == status.HTTP_403_FORBIDDEN

    # Support agent can view queue and claim
    api_client.force_authenticate(user=support_agent)
    resp = api_client.get("/api/support/agent/queue/")
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    results = data["results"] if isinstance(data, dict) and "results" in data else data
    assert conversation.id in [item["id"] for item in results]

    claim = api_client.post(
        f"/api/support/agent/conversations/{conversation.id}/claim/"
    )
    assert claim.status_code == status.HTTP_200_OK
    assert claim.json()["status"] == Conversation.Status.ACTIVE
    assert claim.json()["claimed_by"] == support_agent.id

    # Another agent cannot re-claim the same chat
    second_agent = User.objects.create_user(
        username="agent2", email="agent2@example.com", password="agentpass2"
    )
    second_profile = second_agent.profile
    second_profile.role = UserProfile.Role.SUPPORT_AGENT
    second_profile.save()

    api_client.force_authenticate(user=second_agent)
    conflict = api_client.post(
        f"/api/support/agent/conversations/{conversation.id}/claim/"
    )
    assert conflict.status_code == status.HTTP_409_CONFLICT
    assert conflict.json()["detail"] == "Already claimed"


def test_agent_message_creation_sets_agent_flag(api_client, customer, support_agent):
    """Support agent replies show as agent messages and accept attachments."""
    conversation = Conversation.objects.create(customer=customer)

    upload = SimpleUploadedFile(
        "screenshot.png", b"fake-image-bytes", content_type="image/png"
    )

    api_client.force_authenticate(user=support_agent)
    resp = api_client.post(
        f"/api/support/conversations/{conversation.id}/messages/",
        {"text": "Hello, how can I help?", "attachment": upload},
        format="multipart",
    )

    assert resp.status_code == status.HTTP_201_CREATED
    body = resp.json()
    assert body["is_from_agent"] is True
    assert body["sender"] == support_agent.id
    assert body["attachment"] is not None

    msg = Message.objects.get(id=body["id"])
    assert msg.is_from_agent is True
    assert msg.sender == support_agent
    assert msg.attachment.name.endswith(".png")


def test_attachment_validation_blocks_invalid_and_large_files(api_client, support_agent):
    """Guardrails reject disallowed types and files above 10MB."""
    conversation = Conversation.objects.create()
    api_client.force_authenticate(user=support_agent)

    bad_file = SimpleUploadedFile(
        "notes.txt", b"hello", content_type="text/plain"
    )
    resp = api_client.post(
        f"/api/support/conversations/{conversation.id}/messages/",
        {"text": "invalid file", "attachment": bad_file},
        format="multipart",
    )
    assert resp.status_code == status.HTTP_400_BAD_REQUEST
    assert "File type not allowed" in resp.json()["detail"]

    oversized = SimpleUploadedFile(
        "video.mp4",
        b"x" * (10 * 1024 * 1024 + 2),  # >10MB payload
        content_type="video/mp4",
    )
    resp = api_client.post(
        f"/api/support/conversations/{conversation.id}/messages/",
        {"text": "too big", "attachment": oversized},
        format="multipart",
    )
    assert resp.status_code == status.HTTP_400_BAD_REQUEST
    assert "exceeds 10MB" in resp.json()["detail"]


def test_agent_sees_customer_context(api_client, customer, support_agent, sample_product, monkeypatch):
    """Customer context endpoint surfaces cart, orders, and wishlist data."""
    cart = Cart.objects.get(user=customer)
    cart.items = [{"id": sample_product.id, "qty": 2}]
    cart.save()
    order = Order.objects.create(
        customer=customer,
        status=Order.Status.DELIVERED,
        payment_status=Order.PaymentStatus.APPROVED,
        subtotal=sample_product.price * 2,
        tax_amount=0,
        total_amount=sample_product.price * 2,
        _delivery_address_encrypted="",
    )
    order.delivery_address = "Test Address"
    order.save()

    class DummyWishlist:
        def __init__(self, product_ids):
            self.product_ids = product_ids

    monkeypatch.setattr(
        "catalog.models.Wishlist.objects.get",
        lambda **kwargs: DummyWishlist([sample_product.id]),
    )

    conversation = Conversation.objects.create(
        customer=customer,
        claimed_by=support_agent,
        status=Conversation.Status.ACTIVE,
    )

    api_client.force_authenticate(user=support_agent)
    resp = api_client.get(
        f"/api/support/conversations/{conversation.id}/context/"
    )

    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["cart_items"][0]["id"] == sample_product.id
    assert data["orders"][0]["id"] == order.id
    assert data["wishlist"][0]["id"] == sample_product.id


def test_guest_token_and_owner_access_controls(api_client, customer):
    """Guests need the right token; other users cannot access someone else's chat."""
    guest_conv = Conversation.objects.create(
        guest_name="Guest",
        guest_email="guest@example.com",
        guest_token="guest-token-123",
    )

    denied = api_client.get(f"/api/support/conversations/{guest_conv.id}/")
    assert denied.status_code == status.HTTP_403_FORBIDDEN

    allowed = api_client.get(
        f"/api/support/conversations/{guest_conv.id}/",
        HTTP_X_GUEST_TOKEN="guest-token-123",
    )
    assert allowed.status_code == status.HTTP_200_OK
    assert allowed.json()["guest_token"] == "guest-token-123"

    own_conv = Conversation.objects.create(customer=customer)
    stranger = User.objects.create_user(username="stranger", password="pw12345")
    api_client.force_authenticate(user=stranger)
    forbidden = api_client.get(f"/api/support/conversations/{own_conv.id}/")
    assert forbidden.status_code == status.HTTP_403_FORBIDDEN
