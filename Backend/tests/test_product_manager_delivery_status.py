import pytest
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APIClient

from catalog.models import ScrapedProduct
from orders.models import Delivery, Order, OrderItem


pytestmark = pytest.mark.django_db


def test_product_manager_can_update_delivery_status_to_in_transit():
    # GIVEN: order status = PROCESSING with a delivery
    customer = User.objects.create_user(
        username="customer@example.com",
        email="customer@example.com",
        password="custpass",
    )
    product = ScrapedProduct.objects.create(
        name="Transit Device",
        model="TD-1",
        serialnumber="SN-TD-1",
        description="Device for delivery status test",
        stock=5,
        price=1200,
        warranty="1y",
        distributer="ACME",
        category="Test",
        url="https://example.com/products/transit-device",
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
    delivery = Delivery.objects.create(
        order=order,
        customer=customer,
        product=product,
        quantity=1,
        total_price=product.price,
        delivery_address="123 Test St",
        status=Delivery.Status.PROCESSING,
    )

    # Product manager (staff) updates delivery status
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

    # WHEN: update status to IN_TRANSIT
    res = client.patch(
        f"/api/orders/deliveries/{delivery.id}/status/",
        {"status": "in-transit"},
        format="json",
    )

    # THEN: status updated successfully
    assert res.status_code == status.HTTP_200_OK
    delivery.refresh_from_db()
    order.refresh_from_db()
    assert delivery.status == Delivery.Status.SHIPPED
    assert order.status == Order.Status.SHIPPED
