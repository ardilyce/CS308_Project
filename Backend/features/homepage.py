from django.http import JsonResponse
from django.core.cache import cache
from django.utils.text import slugify
from catalog.models import Category, ScrapedProduct


def homepage(_data=None):
    """
    Build main page payload with a few curated sections.

    Returns JSON of the form:
    {
      "ok": true,
      "sections": {
        "featured_categories": [{id, name, slug}...],
        "featured_products": [{id, name, brand, price, stock, category}...],
        "trending_brands": ["brand1", "brand2", ...]
      }
    }
    """

    cached = cache.get("home_payload")
    if cached:
        return JsonResponse(cached)

    all_categories = list(
        Category.objects.order_by("id").values("id", "name", "slug")
    )
    featured_categories = all_categories[:6]
    category_slug_map = {cat["name"]: cat["slug"] for cat in all_categories}

    products_qs = ScrapedProduct.objects.order_by("-id")[:12]
    featured_products = [
        {
            "id": p.id,
            "name": p.name,
            "brand": p.distributer or "",
            "price": float(p.price),
            "stock": p.stock,
            "category": _category_slug(p.category, category_slug_map),
        }
        for p in products_qs
    ]

    raw_brands = ScrapedProduct.objects.exclude(distributer="").values_list(
        "distributer", flat=True
    )
    trending_brands = []
    seen = set()
    for brand in raw_brands:
        if not brand or brand in seen:
            continue
        seen.add(brand)
        trending_brands.append(brand)
        if len(trending_brands) == 10:
            break

    payload = {
        "ok": True,
        "sections": {
            "featured_categories": featured_categories,
            "featured_products": featured_products,
            "trending_brands": trending_brands,
        },
    }

    cache.set("home_payload", payload, 60)
    return JsonResponse(payload)


def _category_slug(category_name, slug_map):
    if not category_name:
        return None
    return slug_map.get(category_name) or slugify(category_name)

