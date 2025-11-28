from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Cart
from catalog.models import ScrapedProduct as Product


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_cart(request):
    cart, _ = Cart.objects.get_or_create(user=request.user)
    return Response({"items": cart.items})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def add_to_cart(request):
    product_id = request.data.get("product_id")
    product = Product.objects.get(id=product_id)

    # ❗stok 0 ise eklenemez
    if product.stock <= 0:
        return Response({"error": "Out of stock"}, status=400)

    cart, _ = Cart.objects.get_or_create(user=request.user)

    # mevcut qty'yi bul
    existing_qty = 0
    for item in cart.items:
        if item["id"] == product_id:
            existing_qty = item["qty"]

    # ❗eklenmek istenen qty stoktan büyükse → engelle
    if existing_qty + 1 > product.stock:
        return Response({"error": "Not enough stock"}, status=400)

    new_items = []
    updated = False
    for item in cart.items:
        if item["id"] == product_id:
            item["qty"] += 1
            updated = True
        new_items.append(item)

    if not updated:
        new_items.append({"id": product_id, "qty": 1})

    cart.items = new_items
    cart.save()

    return Response({"items": cart.items})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def remove_from_cart(request):
    product_id = request.data.get("product_id")
    if not product_id:
        return Response({"error": "product_id required"}, status=400)

    cart, _ = Cart.objects.get_or_create(user=request.user)

    new_items = []
    for item in cart.items:
        if item["id"] == product_id:
            # 1) Qty'yi azalt
            if item["qty"] > 1:
                new_items.append({"id": item["id"], "qty": item["qty"] - 1})
            # 2) Eğer qty = 1 ise → ekleme (yani tamamen sil)
        else:
            new_items.append(item)

    cart.items = new_items
    cart.save()

    return Response({"items": cart.items})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def merge_cart(request):
    guest_items = request.data.get("guest_items", [])

    if not isinstance(guest_items, list):
        return Response({"error": "guest_items must be a list"}, status=400)

    # Kullanıcıya ait cart
    cart, _ = Cart.objects.get_or_create(user=request.user)

    # 1) Convert backend structure to dict by ID
    backend_map = {}  # id -> qty
    for item in cart.items:
        pid = item.get("id")
        qty = item.get("qty", 1)
        if pid is not None:
            backend_map[pid] = backend_map.get(pid, 0) + qty

    # 2) Merge duplicated guest items
    guest_map = {}  # id -> qty
    for item in guest_items:
        pid = item.get("id")
        qty = item.get("qty", 1)
        if pid is not None:
            guest_map[pid] = guest_map.get(pid, 0) + qty

    # 3) Merge guest → backend
    for pid, qty in guest_map.items():
        backend_map[pid] = backend_map.get(pid, 0) + qty

    # 4) Convert back to list format
    merged_list = [{"id": pid, "qty": qty} for pid, qty in backend_map.items()]

    # Save
    cart.items = merged_list
    cart.save()

    return Response({"items": cart.items})
