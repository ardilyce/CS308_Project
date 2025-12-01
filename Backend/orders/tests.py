from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from catalog.models import ScrapedProduct
from orders.models import Order, OrderItem, Delivery, Invoice

User = get_user_model()


class StockManagementTests(TestCase):
    """Test cases for product stock display and management"""

    def setUp(self):
        """Set up test client and create test data"""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        
        # Create test products with stock
        self.product1 = ScrapedProduct.objects.create(
            name="iPhone 15 Pro",
            model="A2848",
            serialnumber="SN123456",
            description="Latest iPhone",
            stock=10,
            price=50000,
            warranty="2 years",
            distributer="Apple",
            url="https://example.com/iphone15",
            category="Phone"
        )
        
        self.product2 = ScrapedProduct.objects.create(
            name="Samsung Galaxy S24",
            model="SM-S921B",
            serialnumber="SN789012",
            description="Latest Samsung phone",
            stock=5,
            price=40000,
            warranty="2 years",
            distributer="Samsung",
            url="https://example.com/galaxy-s24",
            category="Phone"
        )

    def test_product_stock_displayed_in_product_detail(self):
        """Test that stock information is shown when viewing a product"""
        response = self.client.get(f'/api/products/{self.product1.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['stock'], 10)
        self.assertEqual(response.data['name'], "iPhone 15 Pro")

    def test_product_stock_displayed_in_product_list(self):
        """Test that stock information is shown in product listings"""
        response = self.client.get('/api/products/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Handle paginated response
        if isinstance(response.data, dict) and 'results' in response.data:
            results = response.data['results']
        else:
            results = response.data
        
        self.assertGreater(len(results), 0)
        
        # Find our product in the list
        product_data = next(p for p in results if p['id'] == self.product1.id)
        self.assertEqual(product_data['stock'], 10)

    def test_low_stock_product_display(self):
        """Test that products with low stock show correct quantity"""
        low_stock_product = ScrapedProduct.objects.create(
            name="Limited Edition Phone",
            stock=2,
            price=60000,
            warranty="1 year",
            url="https://example.com/limited",
            category="Phone"
        )
        
        response = self.client.get(f'/api/products/{low_stock_product.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['stock'], 2)

    def test_out_of_stock_product_display(self):
        """Test that out-of-stock products show zero stock"""
        out_of_stock_product = ScrapedProduct.objects.create(
            name="Sold Out Phone",
            stock=0,
            price=30000,
            warranty="1 year",
            url="https://example.com/soldout",
            category="Phone"
        )
        
        response = self.client.get(f'/api/products/{out_of_stock_product.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['stock'], 0)


class OrderCreationAndStockDeductionTests(TestCase):
    """Test cases for order creation and stock deduction"""

    def setUp(self):
        """Set up test client and create test data"""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="buyer",
            email="buyer@example.com",
            password="buyerpass123"
        )
        self.client.force_authenticate(user=self.user)
        
        self.product = ScrapedProduct.objects.create(
            name="Test Product",
            stock=20,
            price=10000,
            warranty="1 year",
            url="https://example.com/test",
            category="Phone"
        )

    def test_stock_decreased_after_order_creation(self):
        """Test that product stock decreases when an order is placed"""
        initial_stock = self.product.stock
        order_quantity = 3
        
        order_data = {
            "items": [
                {"product_id": self.product.id, "quantity": order_quantity}
            ],
            "delivery_address": "123 Test Street, Test City",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test User"
            }
        }
        
        response = self.client.post('/api/orders/', order_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Refresh product from database
        self.product.refresh_from_db()
        
        # Check stock was decreased
        expected_stock = initial_stock - order_quantity
        self.assertEqual(self.product.stock, expected_stock)
        self.assertEqual(self.product.stock, 17)

    def test_stock_decreased_for_multiple_items(self):
        """Test stock decreases correctly with multiple products in one order"""
        product2 = ScrapedProduct.objects.create(
            name="Test Product 2",
            stock=15,
            price=15000,
            warranty="1 year",
            url="https://example.com/test2",
            category="Phone"
        )
        
        initial_stock1 = self.product.stock
        initial_stock2 = product2.stock
        
        order_data = {
            "items": [
                {"product_id": self.product.id, "quantity": 2},
                {"product_id": product2.id, "quantity": 4}
            ],
            "delivery_address": "456 Test Avenue, Test City",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test User"
            }
        }
        
        response = self.client.post('/api/orders/', order_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Refresh products from database
        self.product.refresh_from_db()
        product2.refresh_from_db()
        
        self.assertEqual(self.product.stock, initial_stock1 - 2)
        self.assertEqual(product2.stock, initial_stock2 - 4)

    def test_stock_does_not_go_negative(self):
        """Test that stock goes to 0 and doesn't go negative"""
        self.product.stock = 2
        self.product.save()
        
        # Try to order more than available stock
        order_data = {
            "items": [
                {"product_id": self.product.id, "quantity": 5}
            ],
            "delivery_address": "789 Test Road, Test City",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test User"
            }
        }
        
        response = self.client.post('/api/orders/', order_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Refresh product from database
        self.product.refresh_from_db()
        
        # Stock should not be negative (max(0, stock - quantity))
        self.assertEqual(self.product.stock, 0)


class DeliveryProcessingTests(TestCase):
    """Test cases for order delivery processing"""

    def setUp(self):
        """Set up test client and create test data"""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="customer",
            email="customer@example.com",
            password="customerpass123"
        )
        self.client.force_authenticate(user=self.user)
        
        self.product = ScrapedProduct.objects.create(
            name="Product for Delivery",
            stock=50,
            price=20000,
            warranty="2 years",
            url="https://example.com/delivery-test",
            category="Phone"
        )

    def test_delivery_records_created_on_order(self):
        """Test that delivery records are forwarded to delivery department"""
        order_data = {
            "items": [
                {"product_id": self.product.id, "quantity": 2}
            ],
            "delivery_address": "100 Delivery Street, Shipping City",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test Customer"
            }
        }
        
        response = self.client.post('/api/orders/', order_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        order_id = response.data['id']
        
        # Check that delivery records were created
        deliveries = Delivery.objects.filter(order_id=order_id)
        self.assertEqual(deliveries.count(), 1)
        
        delivery = deliveries.first()
        self.assertEqual(delivery.product.id, self.product.id)
        self.assertEqual(delivery.quantity, 2)
        self.assertEqual(delivery.customer, self.user)
        self.assertEqual(delivery.delivery_address, "100 Delivery Street, Shipping City")
        self.assertFalse(delivery.is_completed)

    def test_multiple_delivery_records_for_multiple_products(self):
        """Test that separate delivery records are created for each product"""
        product2 = ScrapedProduct.objects.create(
            name="Second Product",
            stock=30,
            price=25000,
            warranty="1 year",
            url="https://example.com/second",
            category="Phone"
        )
        
        order_data = {
            "items": [
                {"product_id": self.product.id, "quantity": 1},
                {"product_id": product2.id, "quantity": 3}
            ],
            "delivery_address": "200 Multiple Items Ave",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test Customer"
            }
        }
        
        response = self.client.post('/api/orders/', order_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        order_id = response.data['id']
        
        # Check that multiple delivery records were created
        deliveries = Delivery.objects.filter(order_id=order_id)
        self.assertEqual(deliveries.count(), 2)
        
        # Verify each delivery record
        delivery_products = {d.product.id for d in deliveries}
        self.assertEqual(delivery_products, {self.product.id, product2.id})

    def test_delivery_has_correct_price_information(self):
        """Test that delivery records contain correct pricing"""
        order_data = {
            "items": [
                {"product_id": self.product.id, "quantity": 3}
            ],
            "delivery_address": "300 Price Test Road",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test Customer"
            }
        }
        
        response = self.client.post('/api/orders/', order_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        order_id = response.data['id']
        delivery = Delivery.objects.get(order_id=order_id)
        
        expected_total = Decimal(self.product.price * 3)
        self.assertEqual(delivery.total_price, expected_total)


class OrderStatusAndHistoryTests(TestCase):
    """Test cases for order status tracking and order history"""

    def setUp(self):
        """Set up test client and create test data"""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="shopper",
            email="shopper@example.com",
            password="shopperpass123"
        )
        self.client.force_authenticate(user=self.user)
        
        self.product = ScrapedProduct.objects.create(
            name="Status Test Product",
            stock=100,
            price=15000,
            warranty="1 year",
            url="https://example.com/status-test",
            category="Phone"
        )

    def test_order_starts_with_processing_status(self):
        """Test that newly created orders have PROCESSING status"""
        order_data = {
            "items": [
                {"product_id": self.product.id, "quantity": 1}
            ],
            "delivery_address": "400 Status Street",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test Shopper"
            }
        }
        
        response = self.client.post('/api/orders/', order_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], Order.Status.PROCESSING)
        self.assertEqual(response.data['payment_status'], Order.PaymentStatus.APPROVED)

    def test_order_status_can_be_updated_to_shipped(self):
        """Test that order status can transition to SHIPPED (in-transit)"""
        # Create order
        order = Order.objects.create(
            customer=self.user,
            status=Order.Status.PROCESSING,
            payment_status=Order.PaymentStatus.APPROVED,
            subtotal=15000,
            tax_amount=2700,
            total_amount=17700,
            delivery_address="500 Transit Road"
        )
        
        # Update status to SHIPPED
        order.status = Order.Status.SHIPPED
        order.save()
        
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.SHIPPED)

    def test_order_status_can_be_updated_to_delivered(self):
        """Test that order status can transition to DELIVERED"""
        # Create order
        order = Order.objects.create(
            customer=self.user,
            status=Order.Status.SHIPPED,
            payment_status=Order.PaymentStatus.APPROVED,
            subtotal=15000,
            tax_amount=2700,
            total_amount=17700,
            delivery_address="600 Delivered Lane"
        )
        
        # Update status to DELIVERED
        order.status = Order.Status.DELIVERED
        order.save()
        
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.DELIVERED)

    def test_order_history_shows_all_user_orders(self):
        """Test that order history page shows all orders for the user"""
        # Create multiple orders
        for i in range(3):
            order_data = {
                "items": [
                    {"product_id": self.product.id, "quantity": 1}
                ],
                "delivery_address": f"{700 + i} History Street",
                "payment": {
                    "card_number": "1234 5678 9012 3456",
                    "expiry": "12/25",
                    "cvv": "123",
                    "cardholder_name": "Test Shopper"
                }
            }
            self.client.post('/api/orders/', order_data, format='json')
        
        # Get order history
        response = self.client.get('/api/orders/mine/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Handle paginated response
        if isinstance(response.data, dict) and 'results' in response.data:
            results = response.data['results']
        else:
            results = response.data
        
        self.assertEqual(len(results), 3)

    def test_order_history_shows_correct_status(self):
        """Test that order history displays correct status for each order"""
        # Create orders with different statuses
        order1 = Order.objects.create(
            customer=self.user,
            status=Order.Status.PROCESSING,
            payment_status=Order.PaymentStatus.APPROVED,
            subtotal=10000,
            tax_amount=1800,
            total_amount=11800,
            delivery_address="800 Processing Ave"
        )
        
        order2 = Order.objects.create(
            customer=self.user,
            status=Order.Status.SHIPPED,
            payment_status=Order.PaymentStatus.APPROVED,
            subtotal=20000,
            tax_amount=3600,
            total_amount=23600,
            delivery_address="900 Shipped Road"
        )
        
        order3 = Order.objects.create(
            customer=self.user,
            status=Order.Status.DELIVERED,
            payment_status=Order.PaymentStatus.APPROVED,
            subtotal=30000,
            tax_amount=5400,
            total_amount=35400,
            delivery_address="1000 Delivered Blvd"
        )
        
        # Get order history
        response = self.client.get('/api/orders/mine/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Handle paginated response
        if isinstance(response.data, dict) and 'results' in response.data:
            results = response.data['results']
        else:
            results = response.data
        
        self.assertEqual(len(results), 3)
        
        # Check statuses
        statuses = {order['id']: order['status'] for order in results}
        self.assertEqual(statuses[order1.id], Order.Status.PROCESSING)
        self.assertEqual(statuses[order2.id], Order.Status.SHIPPED)
        self.assertEqual(statuses[order3.id], Order.Status.DELIVERED)

    def test_order_detail_shows_status(self):
        """Test that individual order detail page shows status"""
        order_data = {
            "items": [
                {"product_id": self.product.id, "quantity": 2}
            ],
            "delivery_address": "1100 Detail Street",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test Shopper"
            }
        }
        
        create_response = self.client.post('/api/orders/', order_data, format='json')
        order_id = create_response.data['id']
        
        # Get order detail
        detail_response = self.client.get(f'/api/orders/mine/{order_id}/')
        
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data['status'], Order.Status.PROCESSING)
        self.assertIn('status', detail_response.data)

    def test_order_history_only_shows_user_own_orders(self):
        """Test that users can only see their own orders"""
        # Create another user
        other_user = User.objects.create_user(
            username="otheruser",
            email="other@example.com",
            password="otherpass123"
        )
        
        # Create order for other user
        Order.objects.create(
            customer=other_user,
            status=Order.Status.PROCESSING,
            payment_status=Order.PaymentStatus.APPROVED,
            subtotal=10000,
            tax_amount=1800,
            total_amount=11800,
            delivery_address="Other User Address"
        )
        
        # Create order for current user
        order_data = {
            "items": [
                {"product_id": self.product.id, "quantity": 1}
            ],
            "delivery_address": "1200 Privacy Road",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test Shopper"
            }
        }
        self.client.post('/api/orders/', order_data, format='json')
        
        # Get order history for current user
        response = self.client.get('/api/orders/mine/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Handle paginated response
        if isinstance(response.data, dict) and 'results' in response.data:
            results = response.data['results']
        else:
            results = response.data
        
        # Should only see own order
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['delivery_address'], "1200 Privacy Road")


class OrderStatusTransitionTests(TestCase):
    """Test cases for order status lifecycle transitions"""

    def setUp(self):
        """Set up test client and create test data"""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="lifecycleuser",
            email="lifecycle@example.com",
            password="lifecyclepass123"
        )
        self.client.force_authenticate(user=self.user)
        
        self.product = ScrapedProduct.objects.create(
            name="Lifecycle Test Product",
            stock=100,
            price=10000,
            warranty="1 year",
            url="https://example.com/lifecycle",
            category="Phone"
        )

    def test_complete_order_lifecycle(self):
        """Test complete order lifecycle: PROCESSING -> SHIPPED -> DELIVERED"""
        # 1. Create order (starts as PROCESSING)
        order_data = {
            "items": [
                {"product_id": self.product.id, "quantity": 1}
            ],
            "delivery_address": "1300 Lifecycle Avenue",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Lifecycle User"
            }
        }
        
        response = self.client.post('/api/orders/', order_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order_id = response.data['id']
        
        # Verify PROCESSING status
        order = Order.objects.get(id=order_id)
        self.assertEqual(order.status, Order.Status.PROCESSING)
        
        # 2. Transition to SHIPPED
        order.status = Order.Status.SHIPPED
        order.save()
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.SHIPPED)
        
        # 3. Transition to DELIVERED
        order.status = Order.Status.DELIVERED
        order.save()
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.DELIVERED)
        
        # Verify in order history
        history_response = self.client.get('/api/orders/mine/')
        
        # Handle paginated response
        if isinstance(history_response.data, dict) and 'results' in history_response.data:
            results = history_response.data['results']
        else:
            results = history_response.data
        
        order_in_history = next(o for o in results if o['id'] == order_id)
        self.assertEqual(order_in_history['status'], Order.Status.DELIVERED)

    def test_order_with_delivery_tracking(self):
        """Test order with delivery records through complete lifecycle"""
        # Create order
        order_data = {
            "items": [
                {"product_id": self.product.id, "quantity": 2}
            ],
            "delivery_address": "1400 Tracking Street",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Lifecycle User"
            }
        }
        
        response = self.client.post('/api/orders/', order_data, format='json')
        order_id = response.data['id']
        order = Order.objects.get(id=order_id)
        
        # Get delivery record
        delivery = Delivery.objects.get(order=order)
        self.assertFalse(delivery.is_completed)
        
        # Simulate delivery department processing
        order.status = Order.Status.SHIPPED
        order.save()
        
        # Mark delivery as completed when delivered
        from django.utils import timezone
        order.status = Order.Status.DELIVERED
        order.save()
        
        delivery.is_completed = True
        delivery.delivered_at = timezone.now()
        delivery.save()
        
        delivery.refresh_from_db()
        self.assertTrue(delivery.is_completed)
        self.assertIsNotNone(delivery.delivered_at)


class InvoiceGenerationTests(TestCase):
    """Test cases for invoice generation on order creation"""

    def setUp(self):
        """Set up test client and create test data"""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="invoiceuser",
            email="invoice@example.com",
            password="invoicepass123"
        )
        self.client.force_authenticate(user=self.user)
        
        self.product = ScrapedProduct.objects.create(
            name="Invoice Test Product",
            stock=50,
            price=12000,
            warranty="1 year",
            url="https://example.com/invoice-test",
            category="Phone"
        )

    def test_invoice_created_on_order(self):
        """Test that an invoice is automatically created when order is placed"""
        order_data = {
            "items": [
                {"product_id": self.product.id, "quantity": 1}
            ],
            "delivery_address": "1500 Invoice Road",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Invoice User"
            }
        }
        
        response = self.client.post('/api/orders/', order_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        order_id = response.data['id']
        
        # Check that invoice was created
        invoice = Invoice.objects.filter(order_id=order_id).first()
        self.assertIsNotNone(invoice)
        self.assertEqual(invoice.invoice_number, f"INV-{order_id}")

    def test_invoice_returned_in_order_detail(self):
        """Test that invoice information is included in order detail response"""
        order_data = {
            "items": [
                {"product_id": self.product.id, "quantity": 2}
            ],
            "delivery_address": "1600 Invoice Avenue",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Invoice User"
            }
        }
        
        create_response = self.client.post('/api/orders/', order_data, format='json')
        order_id = create_response.data['id']
        
        # Get order detail
        detail_response = self.client.get(f'/api/orders/mine/{order_id}/')
        
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertIn('invoice', detail_response.data)
        self.assertEqual(detail_response.data['invoice']['invoice_number'], f"INV-{order_id}")
