import pytest
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APIClient

from catalog.models import ScrapedProduct


pytestmark = pytest.mark.django_db


def _as_list(response):
    """
    Extract list payload from either paginated or non-paginated responses.
    """
    data = response.data
    if isinstance(data, dict) and "results" in data:
        return data["results"]
    return data if isinstance(data, list) else []


def test_product_manager_can_create_and_find_product_with_mandatory_fields():
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
        "id": 501,
        "name": "Test Device X",
        "model": "TDX-9000",
        "serialnumber": "SN-ABC-123",
        "description": "Rugged device for QA scenario",
        "stock": 25,
        "price": 1999,
        "warranty": "2y",
        # API serializer expects `brand` which maps to distributer field
        "brand": "ACME Corp",
        "category": "Test",
        "url": "https://example.com/products/test-device-x",
    }

    # WHEN: product manager adds a new product with mandatory fields
    create_res = client.post("/api/products/", payload, format="json")

    # THEN: product is saved successfully
    assert create_res.status_code == status.HTTP_201_CREATED
    created_id = create_res.data["id"]
    product = ScrapedProduct.objects.get(id=created_id)
    assert product.name == payload["name"]
    assert product.serialnumber == payload["serialnumber"]
    assert product.stock == payload["stock"]
    assert product.price == payload["price"]
    assert product.warranty == payload["warranty"]
    assert product.distributer == payload["brand"]

    # AND it appears in the product list
    list_res = client.get("/api/products/")
    assert list_res.status_code == status.HTTP_200_OK
    listed = _as_list(list_res)
    assert any(p["id"] == created_id for p in listed)

    # AND it can be searched by name/description
    search_res = client.get("/api/products/", {"search": "Device X"})
    assert search_res.status_code == status.HTTP_200_OK
    search_results = _as_list(search_res)
    assert any(p["id"] == created_id for p in search_results)
