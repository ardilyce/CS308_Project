import json

import pytest
from django.core.cache import cache
from django.http import JsonResponse
from django.test import RequestFactory

from backend import views
from catalog.models import Category, ScrapedProduct
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
        category = categories[idx % len(categories)]
        products.append(
            ScrapedProduct.objects.create(
                name=f"Product {idx}",
                model=f"Model{idx}",
                serialnumber=f"SN{idx}",
                description=f"Description {idx}",
                stock=idx + 1,
                price=10 + idx,
                warranty="1 Year",
                distributer=f"Brand{idx % 4}",
                url=f"https://example.com/{idx}",
                category=category.name,
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

    slug_map = {c.name: c.slug for c in categories}
    expected_products = [
        {
            "id": prod.id,
            "name": prod.name,
            "brand": prod.distributer,
            "price": float(prod.price),
            "stock": prod.stock,
            "category": slug_map.get(prod.category),
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
        ScrapedProduct.objects.create(
            name=f"Product {idx}",
            model=f"Model{idx}",
            serialnumber=f"SN{idx}",
            description="Desc",
            stock=idx + 10,
            price=50 + idx,
            warranty="1 Year",
            distributer=f"Brand{idx}",
            url=f"https://example.com/t{idx}",
            category=category.name,
        )

    ScrapedProduct.objects.create(
        name="Blank Brand",
        model="ModelX",
        serialnumber="SBlank",
        description="Desc",
        stock=1,
        price=10,
        warranty="1 Year",
        distributer="",
        url="https://example.com/blank",
        category=category.name,
    )
    ScrapedProduct.objects.create(
        name="Duplicate Brand",
        model="ModelDup",
        serialnumber="SDup",
        description="Desc",
        stock=2,
        price=11,
        warranty="1 Year",
        distributer="Brand3",
        url="https://example.com/dup",
        category=category.name,
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
