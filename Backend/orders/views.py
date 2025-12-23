from datetime import datetime
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view
from rest_framework.decorators import permission_classes as perm_classes
from rest_framework.response import Response
from django.db.models import Sum
from catalog.models import ScrapedProduct
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination
from .models import Delivery, Invoice, Order,RefundRequest,RefundItem
from .serializers import DeliverySerializer, OrderCreateSerializer, OrderSerializer,RefundCreateSerializer,RefundRequestSerializer, RefundStatusUpdateSerializer


class FlexiblePageNumberPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


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
            Order.objects.filter(customer=self.request.user)
            .order_by("-created_at")
            .select_related("invoice")
            .prefetch_related(
                "items__product",
                "deliveries__product",
                "deliveries__customer",
            )
        )


class MyOrderDetailView(generics.RetrieveAPIView):
    """
    GET /api/orders/mine/<id>/
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OrderSerializer

    def get_queryset(self):
        return (
            Order.objects.filter(customer=self.request.user)
            .select_related("invoice")
            .prefetch_related(
                "items__product",
                "deliveries__product",
                "deliveries__customer",
            )
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
        return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

    if order.payment_status == Order.PaymentStatus.APPROVED:
        return Response(
            {"message": "Payment already confirmed", "order_id": order.id},
            status=status.HTTP_200_OK,
        )

    order.payment_status = Order.PaymentStatus.APPROVED
    order.status = Order.Status.PAID
    order.save()

    return Response(
        {
            "message": "Payment confirmed successfully",
            "order_id": order.id,
            "status": order.status,
            "payment_status": order.payment_status,
        }
    )


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
        return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

    # Can only cancel if not shipped/delivered
    if order.status in [Order.Status.SHIPPED, Order.Status.DELIVERED]:
        return Response(
            {"error": "Cannot cancel order that has been shipped or delivered"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    order.status = Order.Status.CANCELLED
    if order.payment_status == Order.PaymentStatus.APPROVED:
        order.payment_status = Order.PaymentStatus.REFUNDED
    order.save()

    return Response(
        {
            "message": "Order cancelled successfully",
            "order_id": order.id,
            "status": order.status,
            "payment_status": order.payment_status,
        }
    )


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
            {"error": "order_id is required"}, status=status.HTTP_400_BAD_REQUEST
        )

    try:
        order = (
            Order.objects.select_related("customer")
            .prefetch_related("items__product")
            .get(id=order_id, customer=request.user)
        )
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

    try:
        invoice = order.invoice
    except Invoice.DoesNotExist:
        return Response(
            {"error": "Invoice not found for this order"},
            status=status.HTTP_404_NOT_FOUND,
        )

    # Check if user has email
    recipient_email = request.user.email
    if not recipient_email:
        return Response(
            {"error": "User email not found"}, status=status.HTTP_400_BAD_REQUEST
        )

    try:
        # Generate PDF
        pdf_data = generate_invoice_pdf(order, invoice)

        # Prepare email
        customer_name = (
            request.user.get_full_name()
            if hasattr(request.user, "get_full_name")
            else str(request.user)
        )
        subject = f"Invoice {invoice.invoice_number} - CS308 E-Commerce"

        body = f"""
Dear {customer_name},

Thank you for your order!

Please find attached your invoice for order #{order.id}.

Order Details:
- Invoice Number: {invoice.invoice_number}
- Order Date: {order.created_at.strftime("%B %d, %Y")}
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
            mimetype="application/pdf",
        )

        # Send email
        email.send(fail_silently=False)

        # Mark as sent
        invoice.email_sent = True
        invoice.save()

        return Response(
            {
                "message": "Invoice email sent successfully",
                "invoice_number": invoice.invoice_number,
                "order_id": order.id,
                "email": recipient_email,
            }
        )

    except Exception as e:
        # Log the error in production
        import traceback

        error_detail = traceback.format_exc()
        print(f"Email sending failed: {error_detail}")

        return Response(
            {"error": f"Failed to send invoice email: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


class DeliveryListView(generics.ListAPIView):
    """
    GET /api/orders/deliveries/?status=pending|delivered
    Staff-only endpoint to view delivery queue.
    """

    permission_classes = [permissions.IsAdminUser]
    serializer_class = DeliverySerializer
    pagination_class = FlexiblePageNumberPagination

    def get_queryset(self):
        status_filter = (self.request.query_params.get("status") or "").lower()
        qs = Delivery.objects.select_related(
            "order__invoice", "product", "customer"
        ).order_by("-created_at")
        if status_filter == "pending":
            return qs.filter(is_completed=False)
        if status_filter == "delivered":
            return qs.filter(is_completed=True)
        return qs


@api_view(["PATCH"])
@perm_classes([permissions.IsAdminUser])
def update_delivery_status(request, pk):
    """
    PATCH /api/orders/deliveries/<id>/status/ with {"status": "PROCESSING|SHIPPED|DELIVERED"}
    Updates both delivery completion flag and parent order status.
    """
    status_map = {
        "processing": Order.Status.PROCESSING,
        "shipped": Order.Status.SHIPPED,
        "in-transit": Order.Status.SHIPPED,  # alias from UI wording
        "delivered": Order.Status.DELIVERED,
    }
    new_status = (request.data.get("status") or "").lower()
    if new_status not in status_map:
        return Response({"error": "Invalid status"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        delivery = Delivery.objects.select_related("order").get(pk=pk)
    except Delivery.DoesNotExist:
        return Response(
            {"error": "Delivery not found"}, status=status.HTTP_404_NOT_FOUND
        )

    order_status_value = status_map[new_status]
    delivery.order.status = order_status_value
    if order_status_value == Order.Status.DELIVERED:
        delivery.is_completed = True
        if not delivery.delivered_at:
            delivery.delivered_at = timezone.now()
    else:
        # moving back to processing/in-transit
        delivery.is_completed = False
        delivery.delivered_at = None
    delivery.order.save(update_fields=["status"])
    delivery.save(update_fields=["is_completed", "delivered_at"])

    serializer = DeliverySerializer(delivery)
    return Response(serializer.data)


class InvoiceListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OrderSerializer

    def get_queryset(self):
        return Order.objects.select_related("invoice", "customer").order_by(
            "-created_at"
        )


@api_view(["GET"])
@perm_classes([permissions.IsAdminUser])
def order_invoice_html(request, order_id):
    """
    GET /api/orders/<order_id>/invoice-html/
    Returns the HTML representation of the invoice for the given order.
    Only accessible by staff/managers.
    """
    try:
        order = Order.objects.select_related("customer", "invoice").prefetch_related("items__product").get(id=order_id)
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

    try:
        invoice = order.invoice
    except Invoice.DoesNotExist:
        return Response({"error": "Invoice not found"}, status=status.HTTP_404_NOT_FOUND)

    # HTML Template
    customer_name = order.customer.get_full_name() if hasattr(order.customer, 'get_full_name') else str(order.customer)
    items_html = ""
    for item in order.items.all():
        product_name = item.product.name if hasattr(item.product, 'name') else f"Product #{item.product.id}"
        items_html += f"""
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">{product_name}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">{item.quantity}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₺{float(item.unit_price):.2f}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₺{float(item.line_total):.2f}</td>
            </tr>
        """

    html_content = f"""
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 800px; margin: auto; padding: 30px; border: 1px solid #eee; box-shadow: 0 0 20px rgba(0, 0, 0, 0.05); color: #333; background: #fff;">
        <table cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
            <tr>
                <td colspan="2" style="padding-bottom: 40px;">
                    <table style="width: 100%;">
                        <tr>
                            <td>
                                <h1 style="margin: 0; color: #1a73e8; font-size: 32px; letter-spacing: -1px;">CS308 SHOP</h1>
                                <p style="margin: 5px 0 0 0; color: #777; font-size: 14px;">Electronic Commerce Systems</p>
                            </td>
                            <td style="text-align: right;">
                                <h2 style="margin: 0; color: #444; font-size: 24px; text-transform: uppercase;">Invoice</h2>
                                <p style="margin: 5px 0 0 0; font-size: 14px;">
                                    <strong>#{invoice.invoice_number}</strong><br>
                                    {invoice.issue_date.strftime("%B %d, %Y")}
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>

            <tr>
                <td colspan="2" style="padding-bottom: 40px;">
                    <table style="width: 100%;">
                        <tr>
                            <td style="width: 50%; vertical-align: top;">
                                <h4 style="margin: 0 0 10px 0; font-size: 13px; text-transform: uppercase; color: #999; letter-spacing: 1px;">Bill To:</h4>
                                <p style="margin: 0; font-size: 16px; font-weight: bold;">{customer_name}</p>
                                <p style="margin: 5px 0; font-size: 14px; line-height: 1.5; color: #666;">
                                    {order.customer.email}<br>
                                    {order.delivery_address}
                                </p>
                            </td>
                            <td style="width: 50%; vertical-align: top; text-align: right;">
                                <h4 style="margin: 0 0 10px 0; font-size: 13px; text-transform: uppercase; color: #999; letter-spacing: 1px;">Order Details:</h4>
                                <p style="margin: 0; font-size: 14px; color: #666;">
                                    <strong>Order ID:</strong> #{order.id}<br>
                                    <strong>Payment:</strong> {order.payment_status}<br>
                                    <strong>Date:</strong> {order.created_at.strftime("%B %d, %Y")}
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>

            <tr>
                <td colspan="2">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f8f9fa;">
                                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #eee; font-size: 13px; text-transform: uppercase; color: #666;">Description</th>
                                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #eee; font-size: 13px; text-transform: uppercase; color: #666; width: 80px;">Qty</th>
                                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #eee; font-size: 13px; text-transform: uppercase; color: #666; width: 120px;">Unit Price</th>
                                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #eee; font-size: 13px; text-transform: uppercase; color: #666; width: 120px;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items_html}
                        </tbody>
                    </table>
                </td>
            </tr>

            <tr>
                <td style="padding-top: 30px; vertical-align: top; width: 60%;">
                    <div style="background: #fdfdfd; padding: 20px; border: 1px solid #f0f0f0; border-radius: 8px;">
                        <h4 style="margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; color: #999; letter-spacing: 1px;">Payment Information:</h4>
                        <table style="width: 100%; font-size: 13px; line-height: 1.6;">
                            <tr>
                                <td style="color: #777;">Transaction ID:</td>
                                <td style="text-align: right;">{order.transaction_id or 'N/A'}</td>
                            </tr>
                            <tr>
                                <td style="color: #777;">Card Number:</td>
                                <td style="text-align: right;">{f"•••• {order.card_last_four}" if order.card_last_four else 'N/A'}</td>
                            </tr>
                            <tr>
                                <td style="color: #777;">Auth Method:</td>
                                <td style="text-align: right;">Mock Gateway</td>
                            </tr>
                        </table>
                    </div>
                </td>
                <td style="padding-top: 30px; vertical-align: top; width: 40%;">
                    <table style="width: 100%; font-size: 14px;">
                        <tr>
                            <td style="padding: 8px 0; color: #777;">Subtotal</td>
                            <td style="padding: 8px 0; text-align: right;">₺{float(order.subtotal):.2f}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #777;">Tax (18%)</td>
                            <td style="padding: 8px 0; text-align: right;">₺{float(order.tax_amount):.2f}</td>
                        </tr>
                        <tr style="font-size: 18px; font-weight: bold; color: #1a73e8;">
                            <td style="padding: 15px 0; border-top: 2px solid #eee;">Total</td>
                            <td style="padding: 15px 0; text-align: right; border-top: 2px solid #eee;">₺{float(order.total_amount):.2f}</td>
                        </tr>
                    </table>
                </td>
            </tr>

            <tr>
                <td colspan="2" style="padding-top: 60px; text-align: center; border-top: 1px solid #eee;">
                    <p style="margin: 0; font-size: 16px; color: #444; font-weight: bold;">Thank you for your business!</p>
                    <p style="margin: 5px 0 0 0; font-size: 13px; color: #999;">If you have any questions, please contact us at support@cs308shop.com</p>
                    <div style="margin-top: 20px; font-size: 11px; color: #bbb;">
                        CS308 SHOP - Electronic Commerce Systems Final Project<br>
                        Digital Receipt Generated on {datetime.now().strftime("%Y-%m-%d %H:%M")}
                    </div>
                </td>
            </tr>
        </table>
    </div>
    """
    return Response({"html": html_content})
class RefundCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, order_id: int):
        order = Order.objects.filter(id=order_id).first()
        if not order:
            return Response({"detail": "Order not found"}, status=404)

        serializer = RefundCreateSerializer(
            data=request.data,
            context={"request": request, "order": order},
        )
        serializer.is_valid(raise_exception=True)
        refund = serializer.save()
        return Response(RefundRequestSerializer(refund).data, status=status.HTTP_201_CREATED)


class MyRefundListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = RefundRequestSerializer

    def get_queryset(self):
        return RefundRequest.objects.filter(customer=self.request.user).order_by("-created_at")


class ManagerRefundListView(generics.ListAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = RefundRequestSerializer

    def get_queryset(self):
        qs = RefundRequest.objects.all().order_by("-created_at")
        status_q = (self.request.query_params.get("status") or "").upper()
        if status_q:
            qs = qs.filter(status=status_q)
        return qs


class RefundStatusUpdateView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, refund_id: int):
        refund = RefundRequest.objects.filter(id=refund_id).prefetch_related("items__order_item__product").first()
        if not refund:
            return Response({"detail": "Refund not found"}, status=404)

        serializer = RefundStatusUpdateSerializer(
            data=request.data,
            context={"request": request, "refund": refund},
        )
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data["status"]
        manager_note = (serializer.validated_data.get("manager_note") or "").strip()
        refund_tx = (serializer.validated_data.get("refund_transaction_id") or "").strip()

        # APPROVED/REJECTED/RECEIVED/REFUNDED geçişi
        refund.status = new_status
        if manager_note:
            refund.manager_note = manager_note

        # RECEIVED ise stok geri ekle
        if new_status == RefundRequest.Status.RECEIVED:
            for item in refund.items.all():
                product = item.order_item.product
                ScrapedProduct.objects.filter(id=product.id).update(stock=product.stock + item.quantity)

        # REFUNDED => refunded_amount hesapla + timestamp
        if new_status == RefundRequest.Status.REFUNDED:
            total = refund.items.aggregate(total=Sum("line_total_at_purchase"))["total"] or 0
            refund.refunded_amount = total
            refund.refund_transaction_id = refund_tx
            refund.refunded_at = timezone.now()

            # opsiyonel: order.payment_status = REFUNDED
            refund.order.payment_status = Order.PaymentStatus.REFUNDED
            refund.order.save(update_fields=["payment_status", "updated_at"])

        refund.save()
        return Response(RefundRequestSerializer(refund).data, status=200)