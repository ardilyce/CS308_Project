from rest_framework import serializers
from .models import Order, OrderItem, Invoice, Delivery
from catalog.models import ScrapedProduct as Product


class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_image = serializers.CharField(source="product.image_url", read_only=True)

    class Meta:
        model = OrderItem
        fields = [
            "id",
            "product",
            "product_name",
            "product_image",
            "quantity",
            "unit_price",
            "line_total",
        ]


class InvoiceSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="order.customer.username", read_only=True)
    delivery_address = serializers.CharField(source="order.delivery_address", read_only=True)
    subtotal = serializers.DecimalField(source="order.subtotal", max_digits=10, decimal_places=2, read_only=True)
    tax_amount = serializers.DecimalField(source="order.tax_amount", max_digits=10, decimal_places=2, read_only=True)
    payment_status = serializers.CharField(source="order.payment_status", read_only=True)
    transaction_id = serializers.CharField(source="order.transaction_id", read_only=True)
    card_last_four = serializers.CharField(source="order.card_last_four", read_only=True)
    items = OrderItemSerializer(source="order.items", many=True, read_only=True)

    class Meta:
        model = Invoice
        fields = [
            "invoice_number", 
            "total_amount", 
            "issue_date", 
            "customer_name", 
            "delivery_address",
            "subtotal",
            "tax_amount",
            "payment_status",
            "transaction_id",
            "card_last_four",
            "items"
        ]


class DeliverySerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    customer_name = serializers.CharField(source="customer.username", read_only=True)
    order_status = serializers.CharField(source="order.status", read_only=True)
    invoice_details = InvoiceSerializer(source="order.invoice", read_only=True)

    class Meta:
        model = Delivery
        fields = [
            "id",
            "order",
            "customer",
            "customer_name",
            "product",
            "product_name",
            "quantity",
            "total_price",
            "delivery_address",
            "is_completed",
            "order_status",
            "created_at",
            "delivered_at",
            "invoice_details",
        ]
        read_only_fields = ["order", "customer", "created_at", "delivered_at", "invoice_details"]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    deliveries = DeliverySerializer(many=True, read_only=True)
    invoice = InvoiceSerializer(read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "status",
            "payment_status",
            "transaction_id",
            "card_last_four",
            "subtotal",
            "tax_amount",
            "total_amount",
            "delivery_address",
            "created_at",
            "items",
            "deliveries",
            "invoice",
        ]


# --------- Checkout (create) için ---------


class OrderItemCreateSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)


class PaymentInfoSerializer(serializers.Serializer):
    """Payment card information for mock bank processing"""
    card_number = serializers.CharField(max_length=19)  # formatted: "1234 5678 9012 3456"
    expiry = serializers.CharField(max_length=5)  # "MM/YY"
    cvv = serializers.CharField(max_length=4)
    cardholder_name = serializers.CharField(max_length=100)


def mock_bank_approval(card_number, amount):
    """
    Mock bank approval simulation.
    
    Rules for testing:
    - Cards ending in '0000' are always DECLINED (simulate declined cards)
    - Cards ending in '1111' have 50% chance of failure (simulate random failures)
    - All other cards are APPROVED
    
    Returns:
        dict: {
            'approved': bool,
            'transaction_id': str or None,
            'decline_reason': str or None
        }
    """
    import uuid
    import random
    
    # Extract last 4 digits from formatted card number
    digits_only = card_number.replace(" ", "").replace("-", "")
    last_four = digits_only[-4:] if len(digits_only) >= 4 else digits_only
    
    # Test card scenarios
    if last_four == "0000":
        return {
            'approved': False,
            'transaction_id': None,
            'decline_reason': 'Card declined by issuer'
        }
    
    if last_four == "1111":
        # 50% failure rate for testing
        if random.random() < 0.5:
            return {
                'approved': False,
                'transaction_id': None,
                'decline_reason': 'Insufficient funds'
            }
    
    # Generate mock transaction ID
    transaction_id = f"TXN-{uuid.uuid4().hex[:12].upper()}"
    
    return {
        'approved': True,
        'transaction_id': transaction_id,
        'decline_reason': None
    }


class OrderCreateSerializer(serializers.Serializer):
    items = OrderItemCreateSerializer(many=True, write_only=True)
    delivery_address = serializers.CharField(write_only=True)
    payment = PaymentInfoSerializer(write_only=True)

    def to_representation(self, instance):
        """Return the created order using OrderSerializer"""
        return OrderSerializer(instance).data

    def create(self, validated_data):
        """
        Checkout akışı:
        - Stock validation (BEFORE payment)
        - Mock payment processing
        - Order + OrderItem oluştur
        - Product stok düş
        - Invoice oluştur
        - Delivery (tek tablo) içine: her ürün için bir satır
        """
        from django.db import transaction

        user = self.context["request"].user
        items_data = validated_data["items"]
        delivery_address = validated_data["delivery_address"]
        payment_data = validated_data["payment"]

        # =====================================================
        # STOCK VALIDATION - Check stock before processing payment
        # =====================================================
        stock_errors = []
        products_cache = {}  # Cache products to avoid duplicate queries
        
        for item in items_data:
            product_id = item["product_id"]
            requested_qty = item["quantity"]
            
            try:
                product = Product.objects.get(id=product_id)
                products_cache[product_id] = product
            except Product.DoesNotExist:
                stock_errors.append({
                    "product_id": product_id,
                    "product_name": f"Product #{product_id}",
                    "error": "Product no longer exists",
                    "available_stock": 0,
                    "requested_quantity": requested_qty
                })
                continue
            
            if product.stock <= 0:
                stock_errors.append({
                    "product_id": product_id,
                    "product_name": product.name,
                    "error": "Out of stock",
                    "available_stock": 0,
                    "requested_quantity": requested_qty
                })
            elif product.stock < requested_qty:
                stock_errors.append({
                    "product_id": product_id,
                    "product_name": product.name,
                    "error": "Insufficient stock",
                    "available_stock": product.stock,
                    "requested_quantity": requested_qty
                })
        
        if stock_errors:
            raise serializers.ValidationError({
                "stock_error": "Some products in your cart have insufficient stock",
                "items": stock_errors
            })
        # =====================================================

        # Calculate total first for payment processing
        subtotal = 0
        for item in items_data:
            product = products_cache.get(item["product_id"]) or Product.objects.get(id=item["product_id"])
            quantity = item["quantity"]
            unit_price = product.price
            line_total = unit_price * quantity
            subtotal += float(line_total)

        tax_amount = subtotal * 0.18  # 18% tax
        total_amount = subtotal + tax_amount

        # Extract card last four
        card_digits = payment_data["card_number"].replace(" ", "").replace("-", "")
        card_last_four = card_digits[-4:] if len(card_digits) >= 4 else card_digits

        # Mock bank approval
        payment_result = mock_bank_approval(payment_data["card_number"], total_amount)

        if not payment_result['approved']:
            raise serializers.ValidationError({
                'payment': payment_result['decline_reason'] or 'Payment declined'
            })

        order_items = []

        with transaction.atomic():
            order = Order.objects.create(
                customer=user,
                subtotal=0,
                tax_amount=0,
                total_amount=0,
                delivery_address=delivery_address,
                payment_status=Order.PaymentStatus.APPROVED,
                transaction_id=payment_result['transaction_id'],
                card_last_four=card_last_four,
                status=Order.Status.PROCESSING,
            )

            # OrderItem + stok + Delivery satırları
            subtotal = 0
            for item in items_data:
                product = products_cache.get(item["product_id"]) or Product.objects.get(id=item["product_id"])
                quantity = item["quantity"]

                unit_price = product.price
                line_total = unit_price * quantity
                subtotal += line_total

                # OrderItem
                oi = OrderItem(
                    order=order,
                    product=product,
                    quantity=quantity,
                    unit_price=unit_price,
                    line_total=line_total,
                )
                order_items.append(oi)

                # stok alanı varsa düş
                if hasattr(product, "stock"):
                    product.stock = max(0, product.stock - quantity)
                    product.save()

            OrderItem.objects.bulk_create(order_items)

            tax_amount = subtotal * 0.18  # örnek vergi
            total_amount = subtotal + tax_amount

            order.subtotal = subtotal
            order.tax_amount = tax_amount
            order.total_amount = total_amount
            order.save()

            # Invoice
            invoice = Invoice.objects.create(
                order=order,
                invoice_number=f"INV-{order.id}",
                total_amount=total_amount,
                email_sent=False,
            )

            # Delivery satırları (tek tablo)
            delivery_rows = []
            for oi in order.items.all():
                delivery_rows.append(
                    Delivery(
                        order=order,
                        customer=user,
                        product=oi.product,
                        quantity=oi.quantity,
                        total_price=oi.line_total,  # bu satırın toplamı
                        delivery_address=order.delivery_address,
                    )
                )
            Delivery.objects.bulk_create(delivery_rows)

        # Send invoice email automatically after order creation
        try:
            self._send_invoice_email(order, invoice, user)
        except Exception as e:
            # Log error but don't fail the order creation
            import traceback
            print(f"Warning: Invoice email failed to send: {e}")
            print(traceback.format_exc())

        return order

    def _send_invoice_email(self, order, invoice, user):
        """
        Send invoice email with PDF attachment.
        This is called automatically after order creation.
        """
        from django.core.mail import EmailMessage
        from .invoice_pdf import generate_invoice_pdf
        
        # Check if user has email
        recipient_email = user.email
        if not recipient_email:
            print(f"Cannot send invoice email: User {user.id} has no email address")
            return
        
        # Generate PDF
        pdf_data = generate_invoice_pdf(order, invoice)
        
        # Prepare email
        customer_name = user.get_full_name() if hasattr(user, 'get_full_name') else str(user)
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
        
        print(f"Invoice email sent successfully to {recipient_email} for order {order.id}")
