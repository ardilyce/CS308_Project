import pytest
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APIClient

from catalog.models import Review, ScrapedProduct
from orders.models import Invoice, Order, OrderItem


pytestmark = pytest.mark.django_db


def _find_review(rows, review_id):
    for row in rows:
        if row.get("id") == review_id:
            return row
    return {}


def test_product_manager_can_reject_pending_comment_and_keep_hidden():
    # GIVEN: pending comment exists
    customer = User.objects.create_user(
        username="customer@example.com",
        email="customer@example.com",
        password="custpass",
    )
    product = ScrapedProduct.objects.create(
        name="Review Reject Device",
        model="RR-1",
        serialnumber="SN-RR-1",
        description="Device for review rejection test",
        stock=5,
        price=1200,
        warranty="1y",
        distributer="ACME",
        category="Test",
        url="https://example.com/products/review-reject-device",
    )
    order = Order.objects.create(
        customer=customer,
        subtotal=product.price,
        tax_amount=0,
        total_amount=product.price,
        delivery_address="123 Test St",
        status=Order.Status.DELIVERED,
        payment_status=Order.PaymentStatus.APPROVED,
    )
    OrderItem.objects.create(
        order=order,
        product=product,
        quantity=1,
        unit_price=product.price,
        line_total=product.price,
    )
    Invoice.objects.create(
        order=order,
        invoice_number=f"INV-{order.id}",
        total_amount=product.price,
    )

    review = Review.objects.create(
        product=product,
        user=customer,
        rating=2,
        comment="Not good",
        flag=False,
        rejected=False,
    )

    pm = User.objects.create_user(
        username="pm@example.com",
        email="pm@example.com",
        password="secret123",
        is_staff=True,
    )
    profile = pm.profile
    profile.role = profile.Role.PRODUCT_MANAGER
    profile.save(update_fields=["role"])

    client = APIClient()
    client.force_authenticate(user=pm)

    # WHEN: product manager rejects comment
    res = client.delete(f"/api/reviews/{review.id}/flag/")

    # THEN: comment remains hidden
    assert res.status_code == status.HTTP_200_OK
    review.refresh_from_db()
    assert review.rejected is True

    public_client = APIClient()
    list_res = public_client.get(f"/api/products/{product.id}/reviews/")
    assert list_res.status_code == status.HTTP_200_OK
    rows = list_res.data if isinstance(list_res.data, list) else list_res.data.get("results", [])
    found = _find_review(rows, review.id)
    assert found.get("comment") == ""
