import json

import pytest

from catalog.models import ScrapedProduct
from features.search_bar import search

pytestmark = pytest.mark.django_db


def _create_product(**overrides):
    counter = _create_product.counter
    _create_product.counter += 1
    defaults = {
        "name": f"Product {counter}",
        "model": f"Model {counter}",
        "serialnumber": f"SN-{counter}",
        "description": f"Description {counter}",
        "stock": 10,
        "price": 100 + counter,
        "warranty": "1 year",
        "distributer": "BrandA",
        "url": f"https://example.com/{counter}",
        "category": "Phone",
    }
    defaults.update(overrides)
    return ScrapedProduct.objects.create(**defaults)


_create_product.counter = 1


def _body(params):
    response = search(params)
    assert response.status_code == 200
    return json.loads(response.content)


def test_filters_metadata_is_always_available():
    _create_product(category="Phone", distributer="BrandA")
    _create_product(category="Laptop", distributer="BrandB")

    body = _body({})

    assert body["ok"] is True
    assert body["results"] == []
    filters = body["filters"]
    assert set(filters["categories"]) == {"Phone", "Laptop"}
    assert set(filters["distributors"]) == {"BrandA", "BrandB"}
    assert filters["price"]["min"] <= filters["price"]["max"]


def test_can_filter_by_category_and_price_without_query():
    cheap = _create_product(category="Phone", price=50, distributer="BrandA")
    _create_product(category="Phone", price=500, distributer="BrandA")
    _create_product(category="Laptop", price=60, distributer="BrandB")

    body = _body({"category": "Phone", "min_price": "40", "max_price": "100"})
    ids = [item["id"] for item in body["results"]]

    assert ids == [cheap.id]


def test_sorting_and_stock_filtering():
    in_stock = _create_product(category="Accessory", stock=5, price=200)
    _create_product(category="Accessory", stock=0, price=300)
    cheaper = _create_product(category="Accessory", stock=10, price=150)

    body = _body(
        {
            "category": "Accessory",
            "in_stock": "1",
            "sort": "price_asc",
        }
    )
    prices = [item["price"] for item in body["results"]]
    ids = [item["id"] for item in body["results"]]

    assert prices == sorted(prices)
    assert ids == [cheaper.id, in_stock.id]
