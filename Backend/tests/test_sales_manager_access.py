import pytest
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APIClient

from catalog.models import ScrapedProduct
from orders.models import Invoice, Order


pytestmark = pytest.mark.django_db


def test_sales_manager_can_access_sales_dashboard_endpoints():
    # GIVEN: authenticated sales manager
    manager = User.objects.create_user(
        username="sales@example.com",
        email="sales@example.com",
        password="secret123",
    )
    profile = manager.profile
    profile.role = profile.Role.SALES_MANAGER
    profile.save(update_fields=["role"])

    product = ScrapedProduct.objects.create(
        name="Discount Device",
        model="DD-1",
        serialnumber="SN-DD-1",
        description="Device for sales manager access test",
        stock=10,
        price=1500,
        warranty="1y",
        distributer="ACME",
        category="Test",
        url="https://example.com/products/discount-device",
    )

    customer = User.objects.create_user(
        username="customer@example.com",
        email="customer@example.com",
        password="custpass",
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
    Invoice.objects.create(
        order=order,
        invoice_number=f"INV-{order.id}",
        total_amount=product.price,
    )

    client = APIClient()
    client.force_authenticate(user=manager)

    # WHEN: sales manager accesses sales-specific views (discounts, invoices, refunds)
    discount_res = client.patch(
        "/api/products/apply-discount/",
        {"product_ids": [product.id], "discount_percentage": 10},
        format="json",
    )
    invoices_res = client.get("/api/orders/invoices/")
    refunds_res = client.get("/api/orders/refunds/")

    # THEN: access is granted
    assert discount_res.status_code == status.HTTP_200_OK
    assert invoices_res.status_code == status.HTTP_200_OK
    assert refunds_res.status_code == status.HTTP_200_OK
