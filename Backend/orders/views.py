from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes as perm_classes
from rest_framework.response import Response
from .models import Order, Invoice
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


@api_view(["POST"])
@perm_classes([permissions.IsAuthenticated])
def send_invoice_email(request):
    """
    POST /api/invoices/email/
    Body: { "order_id": 123 } or { "orderId": 123 }
    
    Generates invoice PDF and sends it to the customer via email.
    """
    from django.core.mail import EmailMessage
    from .invoice_pdf import generate_invoice_pdf
    
    # Accept both snake_case and camelCase
    order_id = request.data.get("order_id") or request.data.get("orderId")
    
    if not order_id:
        return Response(
            {"error": "order_id is required"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        order = Order.objects.select_related('customer').prefetch_related('items__product').get(
            id=order_id, 
            customer=request.user
        )
    except Order.DoesNotExist:
        return Response(
            {"error": "Order not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    
    try:
        invoice = order.invoice
    except Invoice.DoesNotExist:
        return Response(
            {"error": "Invoice not found for this order"},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Check if user has email
    recipient_email = request.user.email
    if not recipient_email:
        return Response(
            {"error": "User email not found"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        # Generate PDF
        pdf_data = generate_invoice_pdf(order, invoice)
        
        # Prepare email
        customer_name = request.user.get_full_name() if hasattr(request.user, 'get_full_name') else str(request.user)
        subject = f"Invoice {invoice.invoice_number} - CS308 E-Commerce"
        
        body = f"""
Dear {customer_name},

Thank you for your order!

Please find attached your invoice for order #{order.id}.

Order Details:
- Invoice Number: {invoice.invoice_number}
- Order Date: {order.created_at.strftime('%B %d, %Y')}
- Total Amount: ₺{float(order.total_amount):.2f}
- Payment Status: {order.payment_status}

If you have any questions about your order, please don't hesitate to contact us.

Best regards,
CS308 E-Commerce Team
        """.strip()
        
        # Create email with attachment
        email = EmailMessage(
            subject=subject,
            body=body,
            from_email=None,  # Uses DEFAULT_FROM_EMAIL from settings
            to=[recipient_email],
        )
        
        # Attach PDF
        email.attach(
            filename=f"invoice_{invoice.invoice_number}.pdf",
            content=pdf_data,
            mimetype='application/pdf'
        )
        
        # Send email
        email.send(fail_silently=False)
        
        # Mark as sent
        invoice.email_sent = True
        invoice.save()
        
        return Response({
            "message": "Invoice email sent successfully",
            "invoice_number": invoice.invoice_number,
            "order_id": order.id,
            "email": recipient_email
        })
        
    except Exception as e:
        # Log the error in production
        import traceback
        error_detail = traceback.format_exc()
        print(f"Email sending failed: {error_detail}")
        
        return Response(
            {"error": f"Failed to send invoice email: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

