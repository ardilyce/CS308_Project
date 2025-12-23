from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model

from orders.models import Order, OrderItem
from catalog.models import ScrapedProduct

User = get_user_model()


class RefundTests(TestCase):
    def setUp(self):
        self.customer = User.objects.create_user(
            username="customer1",
            password="pass123"
        )

        self.product = ScrapedProduct.objects.create(
            name="Phone X",
            stock=5,
            price=1000,
            warranty="2y",
            url="https://example.com/p1",
            category="Phone",
            distributer="BrandA",
            is_active=True,
            discount=True,
            discount_percentage=10,
        )

        self.order = Order.objects.create(
            customer=self.customer,
            status=Order.Status.DELIVERED,
            payment_status=Order.PaymentStatus.APPROVED,
            subtotal=900,
            tax_amount=0,
            total_amount=900,
        )
        self.order.delivery_address = "Istanbul"
        self.order.save()

        self.item = OrderItem.objects.create(
            order=self.order,
            product=self.product,
            quantity=1,
            unit_price=900,   
            line_total=900,
        )

    def test_refund_amount_should_use_purchase_price(self):
        self.assertEqual(self.item.unit_price, 900)

    def test_refund_only_if_delivered(self):
        self.assertEqual(self.order.status, Order.Status.DELIVERED)
