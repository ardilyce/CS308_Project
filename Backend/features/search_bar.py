from django.http import JsonResponse
from django.db.models import Q
from catalog.models import Product

def search(data):
    query = data.get("q", "").strip()
    if not query:
        return JsonResponse({"ok": True, "results": []})

    results = Product.objects.filter(
        Q(name__icontains=query) |
        Q(brand__icontains=query) |
        Q(description__icontains=query) |
        Q(category__name__icontains=query)
    ).select_related("category")

    products = [
        {
            "id": p.id,
            "name": p.name,
            "brand": p.brand,
            "price": float(p.price),
            "stock": p.stock,
            "description": p.description,
            "category": p.category.name if hasattr(p, "category") else None,
        }
        for p in results
    ]

    return JsonResponse({"ok": True, "results": products})
