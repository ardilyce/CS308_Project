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


class InvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invoice
        fields = ["invoice_number", "total_amount", "issue_date"]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    deliveries = DeliverySerializer(many=True, read_only=True)
    invoice = InvoiceSerializer(read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "status",
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


class OrderCreateSerializer(serializers.Serializer):
    items = OrderItemCreateSerializer(many=True)
    delivery_address = serializers.CharField()

    def create(self, validated_data):
        """
        Checkout akışı:
        - Order + OrderItem oluştur
        - Product stok düş
        - Invoice oluştur
        - Delivery (tek tablo) içine: her ürün için bir satır
        """
        from django.db import transaction

        user = self.context["request"].user
        items_data = validated_data["items"]
        delivery_address = validated_data["delivery_address"]

        subtotal = 0
        order_items = []

        with transaction.atomic():
            order = Order.objects.create(
                customer=user,
                subtotal=0,
                tax_amount=0,
                total_amount=0,
                delivery_address=delivery_address,
            )

            # OrderItem + stok + Delivery satırları
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

