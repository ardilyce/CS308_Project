from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes as perm_classes
from rest_framework.response import Response
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
      "delivery_address": "...",
      "payment": {
        "card_number": "1234 5678 9012 3456",
        "expiry": "12/25",
        "cvv": "123",
        "cardholder_name": "John Doe"
      }
    }
    
    Mock Payment Test Cards:
    - Cards ending in '0000': Always DECLINED
    - Cards ending in '1111': 50% chance of failure
    - All other cards: APPROVED
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


@api_view(["POST"])
@perm_classes([permissions.IsAuthenticated])
def confirm_payment(request, order_id):
    """
    POST /api/orders/<order_id>/confirm-payment/
    
    Manual payment confirmation (for testing/admin purposes).
    Updates order status to PAID and payment_status to APPROVED.
    """
    try:
        order = Order.objects.get(id=order_id, customer=request.user)
    except Order.DoesNotExist:
        return Response(
            {"error": "Order not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    
    if order.payment_status == Order.PaymentStatus.APPROVED:
        return Response(
            {"message": "Payment already confirmed", "order_id": order.id},
            status=status.HTTP_200_OK
        )
    
    order.payment_status = Order.PaymentStatus.APPROVED
    order.status = Order.Status.PAID
    order.save()
    
    return Response({
        "message": "Payment confirmed successfully",
        "order_id": order.id,
        "status": order.status,
        "payment_status": order.payment_status
    })


@api_view(["POST"])
@perm_classes([permissions.IsAuthenticated])
def cancel_order(request, order_id):
    """
    POST /api/orders/<order_id>/cancel/
    
    Cancel an order (only if not yet shipped).
    """
    try:
        order = Order.objects.get(id=order_id, customer=request.user)
    except Order.DoesNotExist:
        return Response(
            {"error": "Order not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Can only cancel if not shipped/delivered
    if order.status in [Order.Status.SHIPPED, Order.Status.DELIVERED]:
        return Response(
            {"error": "Cannot cancel order that has been shipped or delivered"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    order.status = Order.Status.CANCELLED
    if order.payment_status == Order.PaymentStatus.APPROVED:
        order.payment_status = Order.PaymentStatus.REFUNDED
    order.save()
    
    return Response({
        "message": "Order cancelled successfully",
        "order_id": order.id,
        "status": order.status,
        "payment_status": order.payment_status
    })


