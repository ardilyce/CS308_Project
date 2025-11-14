import json
from decimal import Decimal

import pytest
from django.core.cache import cache
from django.http import JsonResponse
from django.test import RequestFactory

from backend import views
from catalog.models import Category, Product
from features.homepage import homepage

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def clear_home_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def rf():
    return RequestFactory()


def test_homepage_builds_sections_from_models_and_caches_payload(monkeypatch):
    categories = [
        Category.objects.create(name=f"Category {idx}")
        for idx in range(1, 9)
    ]
    products = []
    for idx in range(14):
        products.append(
            Product.objects.create(
                category=categories[idx % len(categories)],
                name=f"Product {idx}",
                brand=f"Brand{idx % 4}",
                price=Decimal("10.50") + Decimal(idx),
                stock=idx + 1,
            )
        )

    recorded = {}

    def fake_cache_set(key, value, timeout):
        recorded["key"] = key
        recorded["value"] = value
        recorded["timeout"] = timeout

    monkeypatch.setattr("features.homepage.cache.set", fake_cache_set)

    response = homepage()
    assert response.status_code == 200
    body = json.loads(response.content)

    assert body["ok"] is True
    sections = body["sections"]

    expected_categories = [
        {"id": c.id, "name": c.name, "slug": c.slug} for c in categories[:6]
    ]
    assert sections["featured_categories"] == expected_categories

    expected_products = [
        {
            "id": prod.id,
            "name": prod.name,
            "brand": prod.brand,
            "price": float(prod.price),
            "stock": prod.stock,
            "category": prod.category.slug,
        }
        for prod in list(reversed(products))[:12]
    ]
    assert sections["featured_products"] == expected_products
    assert set(sections["trending_brands"]) == {f"Brand{i}" for i in range(4)}

    assert recorded["key"] == "home_payload"
    assert recorded["value"] == body
    assert recorded["timeout"] == 60


def test_homepage_limits_trending_brands_and_skips_blanks():
    category = Category.objects.create(name="Electronics")
    for idx in range(12):
        Product.objects.create(
            category=category,
            name=f"Product {idx}",
            brand=f"Brand{idx}",
            price=Decimal("50.00"),
            stock=idx + 10,
        )

    Product.objects.create(
        category=category,
        name="Blank Brand",
        brand="",
        price=Decimal("10.00"),
        stock=1,
    )
    Product.objects.create(
        category=category,
        name="Duplicate Brand",
        brand="Brand3",
        price=Decimal("11.00"),
        stock=2,
    )

    body = json.loads(homepage().content)
    trending = body["sections"]["trending_brands"]

    assert len(trending) == 10
    assert "" not in trending
    assert len(trending) == len(set(trending))


def test_homepage_returns_cached_payload_immediately():
    cached_payload = {
        "ok": True,
        "sections": {
            "featured_categories": [],
            "featured_products": [],
            "trending_brands": ["cached"],
        },
    }

    cache.set("home_payload", cached_payload, 60)
    body = json.loads(homepage().content)

    assert body == cached_payload


def test_homepage_view_rejects_non_get_requests(rf):
    request = rf.post("/api/home/")
    response = views.homepage_view(request)

    assert response.status_code == 405
    assert json.loads(response.content) == {"ok": False, "error": "GET required"}


def test_homepage_view_returns_feature_payload(rf, monkeypatch):
    sentinel = JsonResponse({"ok": True, "sections": {"featured_categories": []}})

    def fake_feature(_payload):
        return sentinel

    monkeypatch.setattr(views, "homepage_feature", fake_feature)

    request = rf.get("/api/home/")
    response = views.homepage_view(request)

    assert response is sentinel
