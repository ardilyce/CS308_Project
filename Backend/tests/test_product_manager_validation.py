import pytest
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APIClient

from catalog.models import ScrapedProduct


pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("missing_field", ["price", "stock"])
def test_product_manager_cannot_create_product_when_mandatory_field_missing(missing_field):
    # GIVEN: authenticated product manager (staff)
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

    payload = {
        "name": "Invalid Device",
        "model": "INV-001",
        "serialnumber": "SN-INV-001",
        "description": "Missing a required field",
        "stock": 10,
        "price": 999,
        "warranty": "1y",
        "brand": "ACME Corp",
        "category": "Test",
        "url": f"https://example.com/products/invalid-{missing_field}",
    }
    payload.pop(missing_field)

    # WHEN: product creation request lacks a mandatory field (price/stock)
    res = client.post("/api/products/", payload, format="json")

    # THEN: validation error returned and product not created
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert ScrapedProduct.objects.count() == 0
