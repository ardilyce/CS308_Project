import pytest
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from catalog.models import ScrapedProduct
from orders.models import Delivery, Order, OrderItem


pytestmark = pytest.mark.django_db


def _first_delivery(data):
    """Extract first delivery row whether paginated or not."""
    if isinstance(data, dict) and "results" in data:
        rows = data.get("results") or []
    elif isinstance(data, list):
        rows = data
    else:
        rows = []
    return rows[0] if rows else {}


def test_product_manager_can_view_delivery_list_with_required_fields():
    # GIVEN: at least one order with a delivery
    customer = User.objects.create_user(
        username="customer@example.com",
        email="customer@example.com",
        password="custpass",
    )
    product = ScrapedProduct.objects.create(
        name="Delivery Widget",
        model="DW-1",
        serialnumber="SN-DW-1",
        description="Widget for delivery listing",
        stock=3,
        price=1500,
        warranty="1y",
        distributer="ACME",
        category="Test",
        url="https://example.com/products/delivery-widget",
    )
    order = Order.objects.create(
        customer=customer,
        subtotal=product.price,
        tax_amount=0,
        total_amount=product.price,
        delivery_address="123 Test St",
        status=Order.Status.PROCESSING,
        payment_status=Order.PaymentStatus.APPROVED,
    )
    OrderItem.objects.create(
        order=order,
        product=product,
        quantity=1,
        unit_price=product.price,
        line_total=product.price,
    )
    Delivery.objects.create(
        order=order,
        customer=customer,
        product=product,
        quantity=1,
        total_price=product.price,
        delivery_address="123 Test St",
        status=Delivery.Status.DELIVERED,
        delivered_at=timezone.now(),
    )

    # Product manager (staff) to view deliveries
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

    # WHEN: product manager views delivery list
    res = client.get("/api/orders/deliveries/")

    # THEN: status 200 and required fields are present
    assert res.status_code == status.HTTP_200_OK
    row = _first_delivery(res.data)
    assert row.get("id") is not None
    assert row.get("customer") == customer.id
    assert row.get("product") == product.id
    assert row.get("quantity") == 1
    assert float(row.get("total_price")) == float(product.price)
    assert row.get("delivery_address")
    # delivery completed flag implied by delivered_at presence for delivered status
    assert row.get("delivered_at") is not None
