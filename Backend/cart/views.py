from rest_framework.decorators import api_view
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
