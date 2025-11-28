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


class DeliverySerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = Delivery
        fields = [
            "id",
            "order",
            "customer",
            "product",
            "product_name",
            "quantity",
            "total_price",
            "delivery_address",
            "is_completed",
            "created_at",
            "delivered_at",
        ]
        read_only_fields = ["order", "customer", "created_at", "delivered_at"]


class InvoiceItemSerializer(serializers.Serializer):
    """Serializer for invoice line items"""
    name = serializers.CharField()
    quantity = serializers.IntegerField()
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=2)
    line_total = serializers.DecimalField(max_digits=10, decimal_places=2)
    product_image = serializers.CharField(allow_null=True, required=False)


class InvoiceSerializer(serializers.ModelSerializer):
    """
    Complete invoice serializer with all data needed for invoice display.
    Includes customer info, items, payment details, etc.
    """
    # Customer info
    customer_name = serializers.SerializerMethodField()
    customer_email = serializers.SerializerMethodField()
    
    # Order-level data
    order_id = serializers.IntegerField(source='order.id', read_only=True)
    order_status = serializers.CharField(source='order.status', read_only=True)
    payment_status = serializers.CharField(source='order.payment_status', read_only=True)
    transaction_id = serializers.CharField(source='order.transaction_id', read_only=True)
    card_last_four = serializers.CharField(source='order.card_last_four', read_only=True)
    delivery_address = serializers.CharField(source='order.delivery_address', read_only=True)
    
    # Financial data
    subtotal = serializers.DecimalField(source='order.subtotal', max_digits=10, decimal_places=2, read_only=True)
    tax_amount = serializers.DecimalField(source='order.tax_amount', max_digits=10, decimal_places=2, read_only=True)
    
    # Line items
    items = serializers.SerializerMethodField()
    
    class Meta:
        model = Invoice
        fields = [
            "invoice_number",
            "issue_date",
            "total_amount",
            "order_id",
            "customer_name",
            "customer_email",
            "delivery_address",
            "subtotal",
            "tax_amount",
            "order_status",
            "payment_status",
            "transaction_id",
            "card_last_four",
            "items",
        ]
    
    def get_customer_name(self, obj):
        user = obj.order.customer
        # Try different name fields
        if hasattr(user, 'full_name') and user.full_name:
            return user.full_name
        if hasattr(user, 'get_full_name'):
            full_name = user.get_full_name()
            if full_name:
                return full_name
        if user.first_name or user.last_name:
            return f"{user.first_name} {user.last_name}".strip()
        return user.username
    
    def get_customer_email(self, obj):
        return obj.order.customer.email or ""
    
    def get_items(self, obj):
        """Return all order items as invoice line items"""
        items_data = []
        for item in obj.order.items.all():
            items_data.append({
                "name": item.product.name if hasattr(item.product, 'name') else f"Product #{item.product_id}",
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "line_total": item.line_total,
                "product_image": getattr(item.product, 'image_url', None),
            })
        return items_data


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

        # Calculate total first for payment processing
        subtotal = 0
        for item in items_data:
            product = Product.objects.get(id=item["product_id"])
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
                product = Product.objects.get(id=item["product_id"])
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
            Invoice.objects.create(
                order=order,
                invoice_number=f"INV-{order.id}",
                total_amount=total_amount,
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

        return order

