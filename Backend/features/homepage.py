from django.http import JsonResponse
from django.core.cache import cache
from catalog.models import Category, Product


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

    featured_categories = list(
        Category.objects.order_by("id").values("id", "name", "slug")[:6]
    )

    products_qs = (
        Product.objects.select_related("category").order_by("-id")[:12]
    )
    featured_products = [
        {
            "id": p.id,
            "name": p.name,
            "brand": p.brand,
            "price": float(p.price),
            "stock": p.stock,
            "category": getattr(p.category, "slug", None),
        }
        for p in products_qs
    ]

    trending_brands = list(
        Product.objects.exclude(brand="")
        .values_list("brand", flat=True)
        .distinct()[:10]
    )

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

