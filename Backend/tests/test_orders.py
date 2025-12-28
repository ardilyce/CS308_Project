"""
Order related tests converted to pytest.
Tests for stock management, order creation, delivery processing,
order status tracking, and invoice generation.
"""
import pytest
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from catalog.models import ScrapedProduct
from orders.models import Order, OrderItem, Delivery, Invoice

User = get_user_model()
pytestmark = pytest.mark.django_db


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def api_client():
    """Return an API client instance."""
    return APIClient()


@pytest.fixture
def test_user(db):
    """Create and return a test user."""
    return User.objects.create_user(
        username="testuser",
        email="test@example.com",
        password="testpass123"
    )


@pytest.fixture
def buyer_user(db):
    """Create and return a buyer user."""
    return User.objects.create_user(
        username="buyer",
        email="buyer@example.com",
        password="buyerpass123"
    )


@pytest.fixture
def customer_user(db):
    """Create and return a customer user."""
    return User.objects.create_user(
        username="customer",
        email="customer@example.com",
        password="customerpass123"
    )


@pytest.fixture
def shopper_user(db):
    """Create and return a shopper user."""
    return User.objects.create_user(
        username="shopper",
        email="shopper@example.com",
        password="shopperpass123"
    )


@pytest.fixture
def lifecycle_user(db):
    """Create and return a lifecycle test user."""
    return User.objects.create_user(
        username="lifecycleuser",
        email="lifecycle@example.com",
        password="lifecyclepass123"
    )


@pytest.fixture
def invoice_user(db):
    """Create and return an invoice test user."""
    return User.objects.create_user(
        username="invoiceuser",
        email="invoice@example.com",
        password="invoicepass123"
    )


@pytest.fixture
def product1(db):
    """Create and return the first test product."""
    return ScrapedProduct.objects.create(
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


@pytest.fixture
def product2(db):
    """Create and return the second test product."""
    return ScrapedProduct.objects.create(
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


@pytest.fixture
def test_product(db):
    """Create and return a generic test product."""
    return ScrapedProduct.objects.create(
        name="Test Product",
        stock=20,
        price=10000,
        warranty="1 year",
        url="https://example.com/test",
        category="Phone"
    )


@pytest.fixture
def delivery_product(db):
    """Create and return a product for delivery tests."""
    return ScrapedProduct.objects.create(
        name="Product for Delivery",
        stock=50,
        price=20000,
        warranty="2 years",
        url="https://example.com/delivery-test",
        category="Phone"
    )


@pytest.fixture
def status_product(db):
    """Create and return a product for status tests."""
    return ScrapedProduct.objects.create(
        name="Status Test Product",
        stock=100,
        price=15000,
        warranty="1 year",
        url="https://example.com/status-test",
        category="Phone"
    )


@pytest.fixture
def lifecycle_product(db):
    """Create and return a product for lifecycle tests."""
    return ScrapedProduct.objects.create(
        name="Lifecycle Test Product",
        stock=100,
        price=10000,
        warranty="1 year",
        url="https://example.com/lifecycle",
        category="Phone"
    )


@pytest.fixture
def invoice_product(db):
    """Create and return a product for invoice tests."""
    return ScrapedProduct.objects.create(
        name="Invoice Test Product",
        stock=50,
        price=12000,
        warranty="1 year",
        url="https://example.com/invoice-test",
        category="Phone"
    )


# ============================================================================
# Stock Management Tests
# ============================================================================

class TestStockManagement:
    """Test cases for product stock display and management."""

    def test_product_stock_displayed_in_product_detail(self, api_client, product1):
        """Test that stock information is shown when viewing a product."""
        response = api_client.get(f'/api/products/{product1.id}/')
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['stock'] == 10
        assert response.data['name'] == "iPhone 15 Pro"

    def test_product_stock_displayed_in_product_list(self, api_client, product1, product2):
        """Test that stock information is shown in product listings."""
        response = api_client.get('/api/products/')
        
        assert response.status_code == status.HTTP_200_OK
        
        # Handle paginated response
        if isinstance(response.data, dict) and 'results' in response.data:
            results = response.data['results']
        else:
            results = response.data
        
        assert len(results) > 0
        
        # Find our product in the list
        product_data = next(p for p in results if p['id'] == product1.id)
        assert product_data['stock'] == 10

    def test_low_stock_product_display(self, api_client):
        """Test that products with low stock show correct quantity."""
        low_stock_product = ScrapedProduct.objects.create(
            name="Limited Edition Phone",
            stock=2,
            price=60000,
            warranty="1 year",
            url="https://example.com/limited",
            category="Phone"
        )
        
        response = api_client.get(f'/api/products/{low_stock_product.id}/')
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['stock'] == 2

    def test_out_of_stock_product_display(self, api_client):
        """Test that out-of-stock products show zero stock."""
        out_of_stock_product = ScrapedProduct.objects.create(
            name="Sold Out Phone",
            stock=0,
            price=30000,
            warranty="1 year",
            url="https://example.com/soldout",
            category="Phone"
        )
        
        response = api_client.get(f'/api/products/{out_of_stock_product.id}/')
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['stock'] == 0


# ============================================================================
# Order Creation and Stock Deduction Tests
# ============================================================================

class TestOrderCreationAndStockDeduction:
    """Test cases for order creation and stock deduction."""

    def test_stock_decreased_after_order_creation(self, api_client, buyer_user, test_product):
        """Test that product stock decreases when an order is placed."""
        api_client.force_authenticate(user=buyer_user)
        
        initial_stock = test_product.stock
        order_quantity = 3
        
        order_data = {
            "items": [
                {"product_id": test_product.id, "quantity": order_quantity}
            ],
            "delivery_address": "123 Test Street, Test City",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test User"
            }
        }
        
        response = api_client.post('/api/orders/', order_data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        
        # Refresh product from database
        test_product.refresh_from_db()
        
        # Check stock was decreased
        expected_stock = initial_stock - order_quantity
        assert test_product.stock == expected_stock
        assert test_product.stock == 17

    def test_stock_decreased_for_multiple_items(self, api_client, buyer_user, test_product):
        """Test stock decreases correctly with multiple products in one order."""
        api_client.force_authenticate(user=buyer_user)
        
        product2 = ScrapedProduct.objects.create(
            name="Test Product 2",
            stock=15,
            price=15000,
            warranty="1 year",
            url="https://example.com/test2",
            category="Phone"
        )
        
        initial_stock1 = test_product.stock
        initial_stock2 = product2.stock
        
        order_data = {
            "items": [
                {"product_id": test_product.id, "quantity": 2},
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
        
        response = api_client.post('/api/orders/', order_data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        
        # Refresh products from database
        test_product.refresh_from_db()
        product2.refresh_from_db()
        
        assert test_product.stock == initial_stock1 - 2
        assert product2.stock == initial_stock2 - 4

    def test_order_rejected_when_insufficient_stock(self, api_client, buyer_user, test_product):
        """Test that order is rejected when requested quantity exceeds available stock."""
        api_client.force_authenticate(user=buyer_user)
        
        test_product.stock = 2
        test_product.save()
        
        # Try to order more than available stock
        order_data = {
            "items": [
                {"product_id": test_product.id, "quantity": 5}
            ],
            "delivery_address": "789 Test Road, Test City",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test User"
            }
        }
        
        response = api_client.post('/api/orders/', order_data, format='json')
        
        # Order should be rejected due to insufficient stock
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        
        # Verify error response contains stock error information
        data = response.json()
        assert "stock_error" in data
        assert "items" in data
        assert len(data["items"]) == 1
        # Values may be serialized as strings in ValidationError
        assert int(data["items"][0]["product_id"]) == test_product.id
        assert int(data["items"][0]["available_stock"]) == 2
        assert int(data["items"][0]["requested_quantity"]) == 5
        
        # Refresh product from database
        test_product.refresh_from_db()
        
        # Stock should remain unchanged (order was rejected)
        assert test_product.stock == 2

    def test_order_succeeds_when_exact_stock_available(self, api_client, buyer_user, test_product):
        """Test that ordering exactly the available stock succeeds and stock goes to 0."""
        api_client.force_authenticate(user=buyer_user)
        
        test_product.stock = 3
        test_product.save()
        
        # Order exactly the available stock
        order_data = {
            "items": [
                {"product_id": test_product.id, "quantity": 3}
            ],
            "delivery_address": "789 Test Road, Test City",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test User"
            }
        }
        
        response = api_client.post('/api/orders/', order_data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        
        # Refresh product from database
        test_product.refresh_from_db()
        
        # Stock should now be 0
        assert test_product.stock == 0


# ============================================================================
# Delivery Processing Tests
# ============================================================================

class TestDeliveryProcessing:
    """Test cases for order delivery processing."""

    def test_delivery_records_created_on_order(self, api_client, customer_user, delivery_product):
        """Test that delivery records are forwarded to delivery department."""
        api_client.force_authenticate(user=customer_user)
        
        order_data = {
            "items": [
                {"product_id": delivery_product.id, "quantity": 2}
            ],
            "delivery_address": "100 Delivery Street, Shipping City",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test Customer"
            }
        }
        
        response = api_client.post('/api/orders/', order_data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        
        order_id = response.data['id']
        
        # Check that delivery records were created
        deliveries = Delivery.objects.filter(order_id=order_id)
        assert deliveries.count() == 1
        
        delivery = deliveries.first()
        assert delivery.product.id == delivery_product.id
        assert delivery.quantity == 2
        assert delivery.customer == customer_user
        assert delivery.delivery_address == "100 Delivery Street, Shipping City"
        assert delivery.status == Delivery.Status.PROCESSING

    def test_multiple_delivery_records_for_multiple_products(self, api_client, customer_user, delivery_product):
        """Test that separate delivery records are created for each product."""
        api_client.force_authenticate(user=customer_user)
        
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
                {"product_id": delivery_product.id, "quantity": 1},
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
        
        response = api_client.post('/api/orders/', order_data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        
        order_id = response.data['id']
        
        # Check that multiple delivery records were created
        deliveries = Delivery.objects.filter(order_id=order_id)
        assert deliveries.count() == 2
        
        # Verify each delivery record
        delivery_products = {d.product.id for d in deliveries}
        assert delivery_products == {delivery_product.id, product2.id}

    def test_delivery_has_correct_price_information(self, api_client, customer_user, delivery_product):
        """Test that delivery records contain correct pricing."""
        api_client.force_authenticate(user=customer_user)
        
        order_data = {
            "items": [
                {"product_id": delivery_product.id, "quantity": 3}
            ],
            "delivery_address": "300 Price Test Road",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test Customer"
            }
        }
        
        response = api_client.post('/api/orders/', order_data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        
        order_id = response.data['id']
        delivery = Delivery.objects.get(order_id=order_id)
        
        expected_total = Decimal(delivery_product.price * 3)
        assert delivery.total_price == expected_total


# ============================================================================
# Order Status and History Tests
# ============================================================================

class TestOrderStatusAndHistory:
    """Test cases for order status tracking and order history."""

    def test_order_starts_with_processing_status(self, api_client, shopper_user, status_product):
        """Test that newly created orders have PROCESSING status."""
        api_client.force_authenticate(user=shopper_user)
        
        order_data = {
            "items": [
                {"product_id": status_product.id, "quantity": 1}
            ],
            "delivery_address": "400 Status Street",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test Shopper"
            }
        }
        
        response = api_client.post('/api/orders/', order_data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['status'] == Order.Status.PROCESSING
        assert response.data['payment_status'] == Order.PaymentStatus.APPROVED

    def test_order_status_can_be_updated_to_shipped(self, shopper_user):
        """Test that order status can transition to SHIPPED (in-transit)."""
        # Create order
        order = Order.objects.create(
            customer=shopper_user,
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
        assert order.status == Order.Status.SHIPPED

    def test_order_status_can_be_updated_to_delivered(self, shopper_user):
        """Test that order status can transition to DELIVERED."""
        # Create order
        order = Order.objects.create(
            customer=shopper_user,
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
        assert order.status == Order.Status.DELIVERED

    def test_order_history_shows_all_user_orders(self, api_client, shopper_user, status_product):
        """Test that order history page shows all orders for the user."""
        api_client.force_authenticate(user=shopper_user)
        
        # Create multiple orders
        for i in range(3):
            order_data = {
                "items": [
                    {"product_id": status_product.id, "quantity": 1}
                ],
                "delivery_address": f"{700 + i} History Street",
                "payment": {
                    "card_number": "1234 5678 9012 3456",
                    "expiry": "12/25",
                    "cvv": "123",
                    "cardholder_name": "Test Shopper"
                }
            }
            api_client.post('/api/orders/', order_data, format='json')
        
        # Get order history
        response = api_client.get('/api/orders/mine/')
        
        assert response.status_code == status.HTTP_200_OK
        
        # Handle paginated response
        if isinstance(response.data, dict) and 'results' in response.data:
            results = response.data['results']
        else:
            results = response.data
        
        assert len(results) == 3

    def test_order_history_shows_correct_status(self, api_client, shopper_user):
        """Test that order history displays correct status for each order."""
        api_client.force_authenticate(user=shopper_user)
        
        # Create orders with different statuses
        order1 = Order.objects.create(
            customer=shopper_user,
            status=Order.Status.PROCESSING,
            payment_status=Order.PaymentStatus.APPROVED,
            subtotal=10000,
            tax_amount=1800,
            total_amount=11800,
            delivery_address="800 Processing Ave"
        )
        
        order2 = Order.objects.create(
            customer=shopper_user,
            status=Order.Status.SHIPPED,
            payment_status=Order.PaymentStatus.APPROVED,
            subtotal=20000,
            tax_amount=3600,
            total_amount=23600,
            delivery_address="900 Shipped Road"
        )
        
        order3 = Order.objects.create(
            customer=shopper_user,
            status=Order.Status.DELIVERED,
            payment_status=Order.PaymentStatus.APPROVED,
            subtotal=30000,
            tax_amount=5400,
            total_amount=35400,
            delivery_address="1000 Delivered Blvd"
        )
        
        # Get order history
        response = api_client.get('/api/orders/mine/')
        
        assert response.status_code == status.HTTP_200_OK
        
        # Handle paginated response
        if isinstance(response.data, dict) and 'results' in response.data:
            results = response.data['results']
        else:
            results = response.data
        
        assert len(results) == 3
        
        # Check statuses
        statuses = {order['id']: order['status'] for order in results}
        assert statuses[order1.id] == Order.Status.PROCESSING
        assert statuses[order2.id] == Order.Status.SHIPPED
        assert statuses[order3.id] == Order.Status.DELIVERED

    def test_order_detail_shows_status(self, api_client, shopper_user, status_product):
        """Test that individual order detail page shows status."""
        api_client.force_authenticate(user=shopper_user)
        
        order_data = {
            "items": [
                {"product_id": status_product.id, "quantity": 2}
            ],
            "delivery_address": "1100 Detail Street",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test Shopper"
            }
        }
        
        create_response = api_client.post('/api/orders/', order_data, format='json')
        order_id = create_response.data['id']
        
        # Get order detail
        detail_response = api_client.get(f'/api/orders/mine/{order_id}/')
        
        assert detail_response.status_code == status.HTTP_200_OK
        assert detail_response.data['status'] == Order.Status.PROCESSING
        assert 'status' in detail_response.data

    def test_order_history_only_shows_user_own_orders(self, api_client, shopper_user, status_product):
        """Test that users can only see their own orders."""
        api_client.force_authenticate(user=shopper_user)
        
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
                {"product_id": status_product.id, "quantity": 1}
            ],
            "delivery_address": "1200 Privacy Road",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test Shopper"
            }
        }
        api_client.post('/api/orders/', order_data, format='json')
        
        # Get order history for current user
        response = api_client.get('/api/orders/mine/')
        
        assert response.status_code == status.HTTP_200_OK
        
        # Handle paginated response
        if isinstance(response.data, dict) and 'results' in response.data:
            results = response.data['results']
        else:
            results = response.data
        
        # Should only see own order
        assert len(results) == 1
        assert results[0]['delivery_address'] == "1200 Privacy Road"


# ============================================================================
# Order Status Transition Tests
# ============================================================================

class TestOrderStatusTransition:
    """Test cases for order status lifecycle transitions."""

    def test_complete_order_lifecycle(self, api_client, lifecycle_user, lifecycle_product):
        """Test complete order lifecycle: PROCESSING -> SHIPPED -> DELIVERED."""
        api_client.force_authenticate(user=lifecycle_user)
        
        # 1. Create order (starts as PROCESSING)
        order_data = {
            "items": [
                {"product_id": lifecycle_product.id, "quantity": 1}
            ],
            "delivery_address": "1300 Lifecycle Avenue",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Lifecycle User"
            }
        }
        
        response = api_client.post('/api/orders/', order_data, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        order_id = response.data['id']
        
        # Verify PROCESSING status
        order = Order.objects.get(id=order_id)
        assert order.status == Order.Status.PROCESSING
        
        # 2. Transition to SHIPPED
        order.status = Order.Status.SHIPPED
        order.save()
        order.refresh_from_db()
        assert order.status == Order.Status.SHIPPED
        
        # 3. Transition to DELIVERED
        order.status = Order.Status.DELIVERED
        order.save()
        order.refresh_from_db()
        assert order.status == Order.Status.DELIVERED
        
        # Verify in order history
        history_response = api_client.get('/api/orders/mine/')
        
        # Handle paginated response
        if isinstance(history_response.data, dict) and 'results' in history_response.data:
            results = history_response.data['results']
        else:
            results = history_response.data
        
        order_in_history = next(o for o in results if o['id'] == order_id)
        assert order_in_history['status'] == Order.Status.DELIVERED

    def test_order_with_delivery_tracking(self, api_client, lifecycle_user, lifecycle_product):
        """Test order with delivery records through complete lifecycle."""
        api_client.force_authenticate(user=lifecycle_user)
        
        # Create order
        order_data = {
            "items": [
                {"product_id": lifecycle_product.id, "quantity": 2}
            ],
            "delivery_address": "1400 Tracking Street",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Lifecycle User"
            }
        }
        
        response = api_client.post('/api/orders/', order_data, format='json')
        order_id = response.data['id']
        order = Order.objects.get(id=order_id)
        
        # Get delivery record
        delivery = Delivery.objects.get(order=order)
        assert delivery.status == Delivery.Status.PROCESSING
        
        # Simulate delivery department processing
        delivery.status = Delivery.Status.SHIPPED
        delivery.save()

        # Mark delivery as completed when delivered
        delivery.status = Delivery.Status.DELIVERED
        delivery.delivered_at = timezone.now()
        delivery.save()
        
        delivery.refresh_from_db()
        assert delivery.status == Delivery.Status.DELIVERED
        assert delivery.delivered_at is not None


# ============================================================================
# Invoice Generation Tests
# ============================================================================

class TestInvoiceGeneration:
    """Test cases for invoice generation on order creation."""

    def test_invoice_created_on_order(self, api_client, invoice_user, invoice_product):
        """Test that an invoice is automatically created when order is placed."""
        api_client.force_authenticate(user=invoice_user)
        
        order_data = {
            "items": [
                {"product_id": invoice_product.id, "quantity": 1}
            ],
            "delivery_address": "1500 Invoice Road",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Invoice User"
            }
        }
        
        response = api_client.post('/api/orders/', order_data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        
        order_id = response.data['id']
        
        # Check that invoice was created
        invoice = Invoice.objects.filter(order_id=order_id).first()
        assert invoice is not None
        assert invoice.invoice_number == f"INV-{order_id}"

    def test_invoice_returned_in_order_detail(self, api_client, invoice_user, invoice_product):
        """Test that invoice information is included in order detail response."""
        api_client.force_authenticate(user=invoice_user)
        
        order_data = {
            "items": [
                {"product_id": invoice_product.id, "quantity": 2}
            ],
            "delivery_address": "1600 Invoice Avenue",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Invoice User"
            }
        }
        
        create_response = api_client.post('/api/orders/', order_data, format='json')
        order_id = create_response.data['id']
        
        # Get order detail
        detail_response = api_client.get(f'/api/orders/mine/{order_id}/')
        
        assert detail_response.status_code == status.HTTP_200_OK
        assert 'invoice' in detail_response.data
        assert detail_response.data['invoice']['invoice_number'] == f"INV-{order_id}"
