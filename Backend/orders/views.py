from datetime import datetime, time
from decimal import Decimal
from django.utils import timezone
import uuid
from django.http import HttpResponse
from django.utils.dateparse import parse_date
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view
from rest_framework.decorators import permission_classes as perm_classes
from rest_framework.response import Response
from django.db import transaction
from django.db.models import F, Sum
from catalog.models import ScrapedProduct
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination
from .models import Delivery, Invoice, Order,RefundRequest,RefundItem
from .serializers import DeliverySerializer, OrderCreateSerializer, OrderSerializer,RefundCreateSerializer,RefundRequestSerializer, RefundStatusUpdateSerializer, CancelOrderItemSerializer


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
        order = Order.objects.select_related().prefetch_related("items__product", "deliveries").get(
            id=order_id, customer=request.user
        )
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

    if order.status == Order.Status.CANCELLED:
        return Response(
            {
                "message": "Order already cancelled",
                "order_id": order.id,
                "status": order.status,
                "payment_status": order.payment_status,
            },
            status=status.HTTP_200_OK,
        )

    # Prevent cancelling after any delivery was completed
    if order.deliveries.filter(status__in=(Delivery.Status.SHIPPED, Delivery.Status.DELIVERED)).exists():
        return Response(
            {"error": "Cannot cancel order that has delivered or shipped items"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    with transaction.atomic():
        # Restore stock for all non-delivered deliveries
        for item in order.items.filter(is_cancelled=False):
            product = item.product
            if hasattr(product, "stock"):
                ScrapedProduct.objects.filter(id=product.id).update(
                    stock=F("stock") + item.quantity
                )

        order.status = Order.Status.CANCELLED
        if order.payment_status == Order.PaymentStatus.APPROVED:
            order.payment_status = Order.PaymentStatus.REFUNDED
        order.save(update_fields=["status", "payment_status", "updated_at"])

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
def cancel_order_item(request, order_id):
    """
    POST /api/orders/<order_id>/cancel-item/
    Body: { "order_item_id": 123 }
    """
    order = (
        Order.objects
        .prefetch_related("items__product", "deliveries")
        .filter(id=order_id, customer=request.user)
        .first()
    )
    if not order:
        return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

    serializer = CancelOrderItemSerializer(
        data=request.data,
        context={"request": request, "order": order},
    )
    serializer.is_valid(raise_exception=True)
    item = serializer.validated_data["item"]

    with transaction.atomic():
        # cancel item
        item.is_cancelled = True
        item.cancelled_at = timezone.now()
        item.save(update_fields=["is_cancelled", "cancelled_at"])

         # 2) restore stock (safe because serializer blocks shipped/delivered)
        if hasattr(item.product, "stock"):
            ScrapedProduct.objects.filter(id=item.product_id).update(
                stock=F("stock") + item.quantity
            )

        # 3) recompute totals safely
        if hasattr(order, "recompute_totals") and callable(getattr(order, "recompute_totals")):
            order.recompute_totals()
        else:
            # fallback: sum non-cancelled items
            subtotal = (
                order.items.filter(is_cancelled=False)
                .aggregate(total=Sum("line_total"))["total"]
                or Decimal("0")
            )
            order.subtotal = subtotal
            order.tax_amount = Decimal("0")
            order.total_amount = subtotal
            order.save(update_fields=["subtotal", "tax_amount", "total_amount", "updated_at"])
        try:
            invoice = order.invoice
            invoice.total_amount = order.total_amount
            invoice.save(update_fields=["total_amount"])
        except Invoice.DoesNotExist:
            pass

        # if all items cancelled -> cancel whole order
        if not order.items.filter(is_cancelled=False).exists():
            order.status = Order.Status.CANCELLED
            order.save(update_fields=["status", "updated_at"])
            if order.payment_status == Order.PaymentStatus.APPROVED:
                order.payment_status = Order.PaymentStatus.REFUNDED
            order.save(update_fields=["status", "payment_status", "updated_at"])


    return Response(
        {
            "message": "Order item cancelled successfully",
            "order_id": order.id,
            "order_status": order.status,
            "cancelled_item_id": item.id,
            "subtotal": str(order.subtotal),
            "total_amount": str(order.total_amount),
        },
        status=status.HTTP_200_OK,
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
            return qs.exclude(status=Delivery.Status.DELIVERED)
        if status_filter == "delivered":
            return qs.filter(status=Delivery.Status.DELIVERED)
        return qs


def _derive_order_status_from_deliveries(order):
    if order.status == Order.Status.CANCELLED:
        return order.status
    delivery_statuses = list(order.deliveries.values_list("status", flat=True))
    if not delivery_statuses:
        return order.status
    if all(status == Delivery.Status.DELIVERED for status in delivery_statuses):
        return Order.Status.DELIVERED
    if all(status in {Delivery.Status.SHIPPED, Delivery.Status.DELIVERED} for status in delivery_statuses):
        return Order.Status.SHIPPED
    return Order.Status.PROCESSING


@api_view(["PATCH"])
@perm_classes([permissions.IsAdminUser])
def update_delivery_status(request, pk):
    """
    PATCH /api/orders/deliveries/<id>/status/ with {"status": "PROCESSING|SHIPPED|DELIVERED"}
    Updates delivery status and derives parent order status.
    """
    status_map = {
        "processing": Delivery.Status.PROCESSING,
        "shipped": Delivery.Status.SHIPPED,
        "in-transit": Delivery.Status.SHIPPED,  # alias from UI wording
        "delivered": Delivery.Status.DELIVERED,
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

    if delivery.order.status == Order.Status.CANCELLED:
        return Response(
            {"error": "Cannot update delivery status for a cancelled order"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    delivery.status = status_map[new_status]
    if delivery.status == Delivery.Status.DELIVERED:
        if not delivery.delivered_at:
            delivery.delivered_at = timezone.now()
    else:
        # moving back to processing/in-transit
        delivery.delivered_at = None
    delivery.save(update_fields=["status", "delivered_at"])

    next_order_status = _derive_order_status_from_deliveries(delivery.order)
    if delivery.order.status != next_order_status:
        delivery.order.status = next_order_status
        delivery.order.save(update_fields=["status"])

    serializer = DeliverySerializer(delivery)
    return Response(serializer.data)


class InvoiceListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OrderSerializer
    pagination_class = None

    def list(self, request, *args, **kwargs):
        profile = getattr(request.user, "profile", None)
        if not profile or not profile.is_staff_role:
            return Response(
                {"error": "Staff role required"},
                status=status.HTTP_403_FORBIDDEN,
            )

        start_raw = request.query_params.get("start_date")
        end_raw = request.query_params.get("end_date")
        self._start_date = parse_date(start_raw) if start_raw else None
        self._end_date = parse_date(end_raw) if end_raw else None
        if start_raw and not self._start_date:
            return Response(
                {"error": "start_date must be YYYY-MM-DD"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if end_raw and not self._end_date:
            return Response(
                {"error": "end_date must be YYYY-MM-DD"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if self._start_date and self._end_date and self._end_date < self._start_date:
            return Response(
                {"error": "end_date must be on or after start_date"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        qs = (
            Order.objects.select_related("invoice", "customer")
            .prefetch_related("items__product", "deliveries__customer")
            .filter(invoice__isnull=False)
            .order_by("-created_at")
        )
        start_date = getattr(self, "_start_date", None)
        end_date = getattr(self, "_end_date", None)
        if start_date:
            qs = qs.filter(invoice__issue_date__date__gte=start_date)
        if end_date:
            qs = qs.filter(invoice__issue_date__date__lte=end_date)
        return qs


@api_view(["GET"])
@perm_classes([permissions.IsAuthenticated])
def revenue_profit_report(request):
    profile = getattr(request.user, "profile", None)
    if not profile or not profile.is_sales_manager:
        return Response(
            {"error": "Sales manager role required"},
            status=status.HTTP_403_FORBIDDEN,
        )

    start_raw = request.query_params.get("start_date")
    end_raw = request.query_params.get("end_date")
    if not start_raw or not end_raw:
        return Response(
            {"error": "start_date and end_date are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    start_date = parse_date(start_raw)
    end_date = parse_date(end_raw)
    if not start_date or not end_date:
        return Response(
            {"error": "start_date and end_date must be YYYY-MM-DD"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    local_tz = timezone.get_current_timezone()
    start_dt = timezone.make_aware(
        datetime.combine(start_date, time.min),
        local_tz,
    )
    end_dt = timezone.make_aware(
        datetime.combine(end_date, time.max),
        local_tz,
    )

    orders = (
        Order.objects.filter(
            payment_status=Order.PaymentStatus.APPROVED,
            created_at__gte=start_dt,
            created_at__lte=end_dt,
        )
        .exclude(status=Order.Status.CANCELLED)
        .exclude(
            refund_requests__status__in=[
                RefundRequest.Status.APPROVED,
                RefundRequest.Status.REFUNDED,
            ]
        )
        .prefetch_related("items__product")
        .distinct()
        .order_by("created_at")
    )

    revenue = Decimal("0")
    cost = Decimal("0")
    per_day = {}

    for order in orders:
        day_key = timezone.localtime(order.created_at, local_tz).date().isoformat()
        per_day.setdefault(day_key, {"revenue": Decimal("0"), "cost": Decimal("0")})
        order_total = Decimal(order.total_amount)
        revenue += order_total
        per_day[day_key]["revenue"] += order_total

        for item in order.items.all():
            unit_cost = item.product.cost
            if unit_cost is None:
                # Fall back to catalog price, not the order's unit price.
                unit_cost = Decimal(item.product.price) * Decimal("0.5")
            item_cost = Decimal(unit_cost) * item.quantity
            cost += item_cost
            per_day[day_key]["cost"] += item_cost

    profit = revenue - cost
    loss = Decimal("0")
    if profit < 0:
        loss = -profit

    def _fmt(value):
        return str(Decimal(value).quantize(Decimal("0.01")))

    chart = []
    for day in sorted(per_day.keys()):
        day_revenue = per_day[day]["revenue"]
        day_cost = per_day[day]["cost"]
        day_profit = day_revenue - day_cost
        chart.append(
            {
                "date": day,
                "revenue": _fmt(day_revenue),
                "cost": _fmt(day_cost),
                "profit": _fmt(day_profit),
            }
        )

    return Response(
        {
            "start_date": start_raw,
            "end_date": end_raw,
            "revenue": _fmt(revenue),
            "cost": _fmt(cost),
            "profit": _fmt(profit),
            "loss": _fmt(loss),
            "chart": chart,
        }
    )


@api_view(["GET"])
@perm_classes([permissions.IsAuthenticated])
def order_invoice_html(request, order_id):
    """
    GET /api/orders/<order_id>/invoice-html/
    Returns the HTML representation of the invoice for the given order.
    Only accessible by staff roles.
    """
    profile = getattr(request.user, "profile", None)
    if not profile or not profile.is_staff_role:
        return Response(
            {"error": "Staff role required"},
            status=status.HTTP_403_FORBIDDEN,
        )
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
                            <td style="padding: 8px 0; color: #777;">Tax (0%)</td>
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


@api_view(["GET"])
@perm_classes([permissions.IsAuthenticated])
def order_invoice_pdf(request, order_id):
    """
    GET /api/orders/<order_id>/invoice-pdf/
    Returns the PDF invoice for the given order.
    Accessible by staff roles or by the customer who owns the order.
    """
    # First, try to get the order as if the user owns it (for customers)
    try:
        order = (
            Order.objects.select_related("customer", "invoice")
            .prefetch_related("items__product")
            .get(id=order_id, customer=request.user)
        )
    except Order.DoesNotExist:
        # Order doesn't belong to user, check if they're staff
        try:
            profile = getattr(request.user, "profile", None)
            is_staff = profile and hasattr(profile, "is_staff_role") and profile.is_staff_role
        except Exception:
            is_staff = False
        
        if is_staff:
            # Staff can access any order
            try:
                order = (
                    Order.objects.select_related("customer", "invoice")
                    .prefetch_related("items__product")
                    .get(id=order_id)
                )
            except Order.DoesNotExist:
                return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)
        else:
            # Not staff and doesn't own the order
            return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

    try:
        invoice = order.invoice
    except Invoice.DoesNotExist:
        return Response({"error": "Invoice not found"}, status=status.HTTP_404_NOT_FOUND)

    from .invoice_pdf import generate_invoice_pdf

    pdf_data = generate_invoice_pdf(order, invoice)
    filename = f"invoice_{invoice.invoice_number}.pdf"
    disposition = (
        "attachment" if request.query_params.get("download") == "1" else "inline"
    )

    response = HttpResponse(pdf_data, content_type="application/pdf")
    response["Content-Disposition"] = f'{disposition}; filename="{filename}"'
    return response
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
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = RefundRequestSerializer

    def list(self, request, *args, **kwargs):
        profile = getattr(request.user, "profile", None)
        if not profile or not profile.is_sales_manager:
            return Response(
                {"error": "Sales manager role required"},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        qs = RefundRequest.objects.all().order_by("-created_at")
        status_q = (self.request.query_params.get("status") or "").upper()
        if status_q:
            qs = qs.filter(status=status_q)
        return qs


class ProductManagerRefundListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = RefundRequestSerializer

    def list(self, request, *args, **kwargs):
        profile = getattr(request.user, "profile", None)
        if not profile or not profile.is_product_manager:
            return Response(
                {"error": "Product manager role required"},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        return (
            RefundRequest.objects.select_related("order", "customer")
            .prefetch_related("items__order_item__product")
            .exclude(status__in=[RefundRequest.Status.RECEIVED, RefundRequest.Status.REFUNDED, RefundRequest.Status.REJECTED])
            .order_by("-created_at")
        )


@api_view(["POST"])
@perm_classes([permissions.IsAuthenticated])
def refund_mark_received(request, refund_id: int):
    profile = getattr(request.user, "profile", None)
    if not profile or not profile.is_product_manager:
        return Response(
            {"error": "Product manager role required"},
            status=status.HTTP_403_FORBIDDEN,
        )

    refund = (
        RefundRequest.objects.filter(id=refund_id)
        .prefetch_related("items__order_item__product")
        .first()
    )
    if not refund:
        return Response({"detail": "Refund not found"}, status=404)

    if refund.status in [
        RefundRequest.Status.RECEIVED,
        RefundRequest.Status.REFUNDED,
    ]:
        return Response(
            {"detail": "Refund cannot be marked received in current status."},
            status=400,
        )

    refund.status = RefundRequest.Status.RECEIVED
    refund.save(update_fields=["status", "updated_at"])
    return Response(RefundRequestSerializer(refund).data, status=200)


class RefundStatusUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, refund_id: int):
        profile = getattr(request.user, "profile", None)
        if not profile or not profile.is_sales_manager:
            return Response(
                {"error": "Sales manager role required"},
                status=status.HTTP_403_FORBIDDEN,
            )
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
        previous_status = refund.status
        refund.status = new_status
        if manager_note:
            refund.manager_note = manager_note

        # APPROVED ise stok geri ekle
        if new_status == RefundRequest.Status.APPROVED and previous_status != RefundRequest.Status.APPROVED:
            for item in refund.items.all():
                product = item.order_item.product
                ScrapedProduct.objects.filter(id=product.id).update(
                    stock=F("stock") + item.quantity
                )

        # REFUNDED => refunded_amount hesapla + timestamp
        if new_status == RefundRequest.Status.REFUNDED:
            if not refund_tx:
                refund_tx = f"RFD-{uuid.uuid4().hex[:12].upper()}"
            total = refund.items.aggregate(total=Sum("line_total_at_purchase"))["total"] or 0
            refund.refunded_amount = total
            refund.refund_transaction_id = refund_tx
            refund.refunded_at = timezone.now()

            # opsiyonel: order.payment_status = REFUNDED
            refund.order.payment_status = Order.PaymentStatus.REFUNDED
            refund.order.save(update_fields=["payment_status", "updated_at"])

        refund.save()
        if new_status == RefundRequest.Status.REFUNDED:
            try:
                from django.core.mail import EmailMessage

                customer = refund.order.customer
                recipient_email = customer.email
                if recipient_email:
                    amount = refund.refunded_amount or 0
                    last_four = refund.order.card_last_four or "N/A"
                    subject = f"Refund completed for Order #{refund.order.id}"
                    body = f"""
Hello {customer.get_full_name() if hasattr(customer, "get_full_name") else customer.username},

Your refund has been completed.

Order ID: {refund.order.id}
Refund Amount: ${float(amount):.2f}
Refunded To: Card ending in {last_four}
Refund Transaction ID: {refund.refund_transaction_id or "N/A"}

If you have any questions, please contact support.
                    """.strip()

                    EmailMessage(
                        subject=subject,
                        body=body,
                        to=[recipient_email],
                    ).send(fail_silently=True)
            except Exception as exc:
                print(f"Refund email failed: {exc}")
        return Response(RefundRequestSerializer(refund).data, status=200)
