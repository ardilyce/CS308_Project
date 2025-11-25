from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Cart


@api_view(["GET"])
def get_cart(request):
    cart, created = Cart.objects.get_or_create(user=request.user)
    return Response({"items": cart.items})


@api_view(["POST"])
def add_to_cart(request):
    cart, created = Cart.objects.get_or_create(user=request.user)

    product_id = request.data.get("product_id")

    if product_id not in cart.items:
        cart.items.append(product_id)
        cart.save()

    return Response({"items": cart.items})


@api_view(["POST"])
def remove_from_cart(request):
    cart, created = Cart.objects.get_or_create(user=request.user)
    product_id = request.data.get("product_id")

    if product_id in cart.items:
        cart.items.remove(product_id)
        cart.save()

    return Response({"items": cart.items})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def merge_cart(request):
    guest_items = request.data.get("guest_items", [])

    if not isinstance(guest_items, list):
        return Response({"error": "guest_items must be a list"}, status=400)

    # Kullanıcı cart'ı
    cart, _ = Cart.objects.get_or_create(user=request.user)

    # Merge logic
    new_items = list(cart.items)

    for item in guest_items:
        if item not in new_items:
            new_items.append(item)

    cart.items = new_items
    cart.save()

    return Response({"items": cart.items})
