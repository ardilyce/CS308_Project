from decimal import Decimal, InvalidOperation

from catalog.models import Review as CatalogReview
from catalog.models import ScrapedProduct
from django.db.models import Avg, Max, Min, Q
from django.http import JsonResponse

MAX_RESULTS = 200

SORT_MAP = {
    "price_asc": "price",
    "price_desc": "-price",
    "name_asc": "name",
    "name_desc": "-name",
    "newest": "-id",
}


def _first_non_empty(data, *keys):
    for key in keys:
        value = data.get(key)
        if value not in (None, ""):
            return value
    return ""


def _parse_decimal(value):
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


def _parse_bool(value):
    if value in (None, ""):
        return False
    return str(value).lower() in {"1", "true", "yes", "on"}


def _build_filters_payload():
    categories = list(
        ScrapedProduct.objects.order_by("category")
        .values_list("category", flat=True)
        .distinct()
    )
    distributors = list(
        ScrapedProduct.objects.exclude(distributer__exact="")
        .order_by("distributer")
        .values_list("distributer", flat=True)
        .distinct()
    )
    price_stats = ScrapedProduct.objects.aggregate(
        min_price=Min("price"), max_price=Max("price")
    )
    return {
        "categories": categories,
        "distributors": distributors,
        "price": {
            "min": float(price_stats["min_price"] or 0),
            "max": float(price_stats["max_price"] or 0),
        },
    }


def search(data):
    query = (data.get("q") or "").strip()
    category = _first_non_empty(data, "category").strip()
    distributor = _first_non_empty(data, "distributor", "brand", "distributer").strip()
    min_price = _parse_decimal(
        _first_non_empty(
            data,
            "min_price",
            "price_min",
            "minPrice",
        )
    )
    max_price = _parse_decimal(
        _first_non_empty(
            data,
            "max_price",
            "price_max",
            "maxPrice",
        )
    )
    in_stock = _parse_bool(data.get("in_stock"))
    sort_key = (data.get("sort") or "").strip()

    applied = {
        "q": query,
        "category": category,
        "distributor": distributor,
        "min_price": float(min_price) if min_price is not None else None,
        "max_price": float(max_price) if max_price is not None else None,
        "in_stock": in_stock,
        "sort": sort_key or "newest",
    }

    filters_payload = _build_filters_payload()

    qs = ScrapedProduct.objects.all()

    if query:
        qs = qs.filter(
            Q(name__icontains=query)
            | Q(model__icontains=query)
            | Q(serialnumber__icontains=query)
            | Q(distributer__icontains=query)
            | Q(description__icontains=query)
            | Q(category__icontains=query)
        )

    if category:
        qs = qs.filter(category__iexact=category)

    if distributor:
        qs = qs.filter(distributer__iexact=distributor)

    if min_price is not None and max_price is not None and min_price > max_price:
        min_price, max_price = max_price, min_price

    if min_price is not None:
        qs = qs.filter(price__gte=min_price)

    if max_price is not None:
        qs = qs.filter(price__lte=max_price)

    if in_stock:
        qs = qs.filter(stock__gt=0)

    # Normal sorting (except popularity)
    order_by = SORT_MAP.get(sort_key, "-id")
    secondary_order = "-id" if order_by != "-id" else "name"
    qs = qs.order_by(order_by, secondary_order)[:MAX_RESULTS]

    # 1) Collect product IDs
    product_ids = list(qs.values_list("id", flat=True))

    # 2) One-query rating aggregation
    rating_map = {
        row["product_id"]: row["avg_rating"]
        for row in CatalogReview.objects.filter(product_id__in=product_ids)
        .values("product_id")
        .annotate(avg_rating=Avg("rating"))
    }

    products = [
        {
            "id": p.id,
            "name": p.name,
            "brand": p.distributer or "",
            "price": float(p.price),
            "stock": p.stock,
            "description": p.description,
            "category": p.category,
            "model": p.model,
            "serialnumber": p.serialnumber,
            "url": p.url,
            # ⭐ Popularity = avg rating
            "popularity": float(rating_map.get(p.id, 0) or 0),
        }
        for p in qs
    ]

    if sort_key == "popularity_desc":
        products = sorted(products, key=lambda x: x["popularity"], reverse=True)
    elif sort_key == "popularity_asc":
        products = sorted(products, key=lambda x: x["popularity"])

    return JsonResponse(
        {
            "ok": True,
            "results": products,
            "filters": filters_payload,
            "applied": applied,
        }
    )
