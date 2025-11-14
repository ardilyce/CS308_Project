from django.http import JsonResponse
from django.db.models import Q
from catalog.models import ScrapedProduct

def search(data):
    query = data.get("q", "").strip()
    if not query:
        return JsonResponse({"ok": True, "results": []})

    results = ScrapedProduct.objects.filter(
        Q(name__icontains=query)
        | Q(model__icontains=query)
        | Q(serialnumber__icontains=query)
        | Q(distributer__icontains=query)
        | Q(description__icontains=query)
        | Q(category__icontains=query)
    )

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
        }
        for p in results
    ]

    return JsonResponse({"ok": True, "results": products})
