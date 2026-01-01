import pytest
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APIClient

from catalog.models import ScrapedProduct


pytestmark = pytest.mark.django_db


def test_product_manager_can_update_stock_and_customers_see_change():
    # GIVEN: existing product with stock = N
    product = ScrapedProduct.objects.create(
        name="Stocked Device",
        model="SD-100",
        serialnumber="SN-STOCK-1",
        description="Base device for stock update test",
        stock=5,
        price=1000,
        warranty="1y",
        distributer="ACME",
        category="Test",
        url="https://example.com/products/stocked-device",
    )

    # Authenticated product manager
    user = User.objects.create_user(
        username="pm@example.com",
        email="pm@example.com",
        password="secret123",
        is_staff=True,
    )
    profile = user.profile
    profile.role = profile.Role.PRODUCT_MANAGER
    profile.save(update_fields=["role"])

    client = APIClient()
    client.force_authenticate(user=user)

    # WHEN: product manager updates stock to N + X
    new_stock = product.stock + 7
    res = client.patch(
        "/api/products/stock/",
        {"stocks": [{"id": product.id, "stock": new_stock}]},
        format="json",
    )

    # THEN: stock value is updated
    assert res.status_code in (status.HTTP_200_OK, status.HTTP_204_NO_CONTENT)
    product.refresh_from_db()
    assert product.stock == new_stock

    # AND updated stock is visible to customers immediately (public GET)
    public_client = APIClient()
    public_res = public_client.get(f"/api/products/{product.id}/")
    assert public_res.status_code == status.HTTP_200_OK
    assert public_res.data["stock"] == new_stock
