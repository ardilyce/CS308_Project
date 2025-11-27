from rest_framework import generics, permissions
from .models import Order
from .serializers import OrderCreateSerializer, OrderSerializer


class OrderCreateView(generics.CreateAPIView):
    """
    POST /api/orders/
    Body:
    {
      "items": [
        { "product_id": 1, "quantity": 2 },
        { "product_id": 3, "quantity": 1 }
      ],
      "delivery_address": "..."
    }
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OrderCreateSerializer


class MyOrdersListView(generics.ListAPIView):
    """
    GET /api/orders/mine/
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OrderSerializer

    def get_queryset(self):
        return (
            Order.objects
            .filter(customer=self.request.user)
            .order_by("-created_at")
            .prefetch_related("items", "deliveries")
        )


class MyOrderDetailView(generics.RetrieveAPIView):
    """
    GET /api/orders/mine/<id>/
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OrderSerializer

    def get_queryset(self):
        return (
            Order.objects
            .filter(customer=self.request.user)
            .prefetch_related("items", "deliveries")
        )


