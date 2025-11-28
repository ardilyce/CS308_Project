from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import transaction

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


def _sanitize_cart_item(item):
    """
    Sanitize and validate a single cart item.
    Returns (product_id, qty) tuple or (None, None) if invalid.
    """
    if not isinstance(item, dict):
        return None, None

    pid = item.get("id")
    qty = item.get("qty", 1)

    # Validate product_id is a valid integer
    if pid is None:
        return None, None
    try:
        pid = int(pid)
    except (ValueError, TypeError):
        return None, None

    # Validate qty is a positive integer
    try:
        qty = int(qty)
    except (ValueError, TypeError):
        qty = 1

    if qty < 1:
        return None, None

    return pid, qty


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def merge_cart(request):
    """
    Merge guest cart items with user's existing cart.
    
    Validates:
    - Product existence (removes non-existent products)
    - Stock availability (caps quantities to available stock)
    - Deduplicates items deterministically (by product ID)
    
    Returns:
    - items: Final merged cart
    - warnings: List of issues encountered (removed/capped items)
    """
    guest_items = request.data.get("guest_items", [])

    if not isinstance(guest_items, list):
        return Response({"error": "guest_items must be a list"}, status=400)

    # Track warnings for frontend feedback
    warnings = []

    # Get user's cart
    cart, _ = Cart.objects.get_or_create(user=request.user)

    # 1) Sanitize and aggregate backend cart items by product ID
    backend_map = {}  # pid -> qty
    for item in cart.items:
        pid, qty = _sanitize_cart_item(item)
        if pid is not None:
            backend_map[pid] = backend_map.get(pid, 0) + qty

    # 2) Sanitize and aggregate guest cart items by product ID
    guest_map = {}  # pid -> qty
    invalid_guest_count = 0
    for item in guest_items:
        pid, qty = _sanitize_cart_item(item)
        if pid is not None:
            guest_map[pid] = guest_map.get(pid, 0) + qty
        else:
            invalid_guest_count += 1

    if invalid_guest_count > 0:
        warnings.append(f"Ignored {invalid_guest_count} invalid guest cart item(s)")

    # 3) Merge guest → backend (sum quantities)
    merged_map = dict(backend_map)
    for pid, qty in guest_map.items():
        merged_map[pid] = merged_map.get(pid, 0) + qty

    # 4) Validate product existence and stock
    all_product_ids = list(merged_map.keys())
    
    if all_product_ids:
        # Fetch all products in one query for efficiency
        products = Product.objects.filter(id__in=all_product_ids)
        product_map = {p.id: p for p in products}

        validated_map = {}
        for pid, requested_qty in merged_map.items():
            product = product_map.get(pid)

            if product is None:
                # Product doesn't exist anymore
                product_name = f"Product #{pid}"
                warnings.append(f"Removed '{product_name}': product no longer exists")
                continue

            if product.stock <= 0:
                # Out of stock - remove from cart
                warnings.append(f"Removed '{product.name}': out of stock")
                continue

            if requested_qty > product.stock:
                # Cap to available stock
                warnings.append(
                    f"Adjusted '{product.name}' quantity from {requested_qty} to {product.stock} (stock limit)"
                )
                validated_map[pid] = product.stock
            else:
                validated_map[pid] = requested_qty
    else:
        validated_map = {}

    # 5) Convert to list format with deterministic ordering (sorted by product ID)
    merged_list = [
        {"id": pid, "qty": qty}
        for pid, qty in sorted(validated_map.items(), key=lambda x: x[0])
    ]

    # 6) Save
    cart.items = merged_list
    cart.save()

    response_data = {"items": cart.items}
    if warnings:
        response_data["warnings"] = warnings

    return Response(response_data)
