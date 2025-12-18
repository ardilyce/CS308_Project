from decimal import Decimal, InvalidOperation

from catalog.models import Review as CatalogReview
from catalog.models import ScrapedProduct
from django.db.models import Avg, Max, Min, Q
from django.http import JsonResponse

MAX_RESULTS = 200
DEFAULT_PAGE_SIZE = 12
MAX_PAGE_SIZE = 48

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


def _parse_int(value, default=None, min_val=None, max_val=None):
    if value in (None, ""):
        return default
    try:
        result = int(str(value))
        if min_val is not None and result < min_val:
            result = min_val
        if max_val is not None and result > max_val:
            result = max_val
        return result
    except (TypeError, ValueError):
        return default


def _build_filters_payload():
    base_qs = ScrapedProduct.objects.filter(is_active=True)

    categories = list(
        base_qs.order_by("category").values_list("category", flat=True).distinct()
    )

    distributors = list(
        base_qs.exclude(distributer__exact="")
        .order_by("distributer")
        .values_list("distributer", flat=True)
        .distinct()
    )

    price_stats = base_qs.aggregate(
        min_price=Min("price"),
        max_price=Max("price"),
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

    # Pagination parameters
    page = _parse_int(data.get("page"), default=1, min_val=1)
    page_size = _parse_int(
        data.get("page_size"),
        default=DEFAULT_PAGE_SIZE,
        min_val=1,
        max_val=MAX_PAGE_SIZE,
    )

    applied = {
        "q": query,
        "category": category,
        "distributor": distributor,
        "min_price": float(min_price) if min_price is not None else None,
        "max_price": float(max_price) if max_price is not None else None,
        "in_stock": in_stock,
        "sort": sort_key or "newest",
        "page": page,
        "page_size": page_size,
    }

    filters_payload = _build_filters_payload()

    qs = ScrapedProduct.objects.filter(is_active=True)

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
    qs = qs.order_by(order_by, secondary_order)

    # Get total count before slicing (for pagination metadata)
    total_count = qs.count()
    total_pages = (total_count + page_size - 1) // page_size  # Ceiling division

    # Ensure page is within valid range
    if page > total_pages and total_pages > 0:
        page = total_pages

    # Calculate offset and slice for lazy loading (only fetch current page)
    offset = (page - 1) * page_size
    qs_page = qs[offset : offset + page_size]

    # 1) Collect product IDs for current page only
    product_ids = list(qs_page.values_list("id", flat=True))

    # 2) One-query rating aggregation for current page products
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
            "image_url": p.image_url,  # Uses local media
            # ⭐ Popularity = avg rating
            "popularity": float(rating_map.get(p.id, 0) or 0),
        }
        for p in qs_page
    ]

    # Handle popularity sorting (requires fetching all, then paginating)
    # For performance, we sort after fetching the page - not ideal but maintains compatibility
    if sort_key == "popularity_desc":
        products = sorted(products, key=lambda x: x["popularity"], reverse=True)
    elif sort_key == "popularity_asc":
        products = sorted(products, key=lambda x: x["popularity"])

    # Pagination metadata
    pagination = {
        "page": page,
        "page_size": page_size,
        "total_count": total_count,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_previous": page > 1,
    }

    return JsonResponse(
        {
            "ok": True,
            "results": products,
            "filters": filters_payload,
            "applied": applied,
            "pagination": pagination,
        }
    )
