"""
Cart and checkout related tests converted to pytest.
Tests for anonymous browsing, cart merging, checkout authentication,
payment processing, and invoice email functionality.
"""
import pytest
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from rest_framework import status
from rest_framework.test import APIClient

from catalog.models import ScrapedProduct, Category
from cart.models import Cart
from orders.models import Order, Invoice

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
def user(db):
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
def product3(db):
    """Create and return the third test product with low stock."""
    return ScrapedProduct.objects.create(
        name="Product 3",
        stock=5,
        price=20000,
        warranty="1 year",
        url="https://example.com/p3",
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


# ============================================================================
# Anonymous Browsing Tests
# ============================================================================

class TestAnonymousBrowsing:
    """Test cases for browsing products without authentication."""

    def test_unauthenticated_user_can_view_product_list(self, api_client, product1, product2):
        """Test that anonymous users can browse product catalog."""
        response = api_client.get('/api/products/')
        
        assert response.status_code == status.HTTP_200_OK
        
        # Handle paginated response
        if isinstance(response.data, dict) and 'results' in response.data:
            results = response.data['results']
        else:
            results = response.data
        
        assert len(results) > 0
        assert any(p['name'] == "iPhone 15 Pro" for p in results)

    def test_unauthenticated_user_can_view_product_detail(self, api_client, product1):
        """Test that anonymous users can view product details."""
        response = api_client.get(f'/api/products/{product1.id}/')
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['name'] == "iPhone 15 Pro"
        assert response.data['stock'] == 10
        assert response.data['price'] == 50000

    def test_unauthenticated_user_can_search_products(self, api_client, product1, product2):
        """Test that anonymous users can search for products."""
        response = api_client.get('/api/products/?search=iPhone')
        
        assert response.status_code == status.HTTP_200_OK
        
        # Handle paginated response
        if isinstance(response.data, dict) and 'results' in response.data:
            results = response.data['results']
        else:
            results = response.data
        
        # Should find iPhone product
        assert any('iPhone' in p['name'] for p in results)

    def test_unauthenticated_user_can_filter_by_category(self, api_client, product1, product2):
        """Test that anonymous users can filter products by category."""
        # First, create a category to filter by
        Category.objects.create(name="Phone", slug="phone")
        
        response = api_client.get('/api/products/?category=phone')
        
        assert response.status_code == status.HTTP_200_OK
        
        # Handle paginated response
        if isinstance(response.data, dict) and 'results' in response.data:
            results = response.data['results']
        else:
            results = response.data
        
        assert len(results) > 0

    def test_unauthenticated_user_cannot_access_cart(self, api_client):
        """Test that anonymous users cannot access backend cart endpoint."""
        response = api_client.get('/api/cart/')
        
        # Should require authentication
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_unauthenticated_user_cannot_add_to_backend_cart(self, api_client, product1):
        """Test that anonymous users cannot add to backend cart directly."""
        response = api_client.post('/api/cart/add/', {
            'product_id': product1.id
        }, format='json')
        
        # Should require authentication
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ============================================================================
# Cart Merge Tests
# ============================================================================

class TestCartMergeOnLogin:
    """Test cases for cart merging when user logs in after adding items as guest."""

    def test_guest_cart_merged_with_empty_user_cart(self, api_client, user, product1, product2):
        """Test that guest cart items are merged when user logs in with empty cart."""
        # Simulate guest cart items (what would come from localStorage)
        guest_items = [
            {"id": product1.id, "qty": 2},
            {"id": product2.id, "qty": 1}
        ]
        
        # User logs in and merges cart
        api_client.force_authenticate(user=user)
        response = api_client.post('/api/cart/merge/', {
            'guest_items': guest_items
        }, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        assert 'items' in response.data
        
        # Verify merged items
        items = response.data['items']
        assert len(items) == 2
        
        # Check quantities are preserved
        item_map = {item['id']: item['qty'] for item in items}
        assert item_map[product1.id] == 2
        assert item_map[product2.id] == 1

    def test_guest_cart_merged_with_existing_user_cart(self, api_client, user, product1, product2):
        """Test that guest cart items are combined with existing user cart."""
        # User already has items in backend cart
        cart, _ = Cart.objects.get_or_create(user=user)
        cart.items = [{"id": product1.id, "qty": 1}]
        cart.save()
        
        # Guest cart has same product and a new product
        guest_items = [
            {"id": product1.id, "qty": 2},  # Will be added to existing
            {"id": product2.id, "qty": 3}   # New product
        ]
        
        api_client.force_authenticate(user=user)
        response = api_client.post('/api/cart/merge/', {
            'guest_items': guest_items
        }, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        
        # Verify quantities were summed
        items = response.data['items']
        item_map = {item['id']: item['qty'] for item in items}
        
        # Product 1: 1 (backend) + 2 (guest) = 3
        assert item_map[product1.id] == 3
        # Product 2: 0 (backend) + 3 (guest) = 3
        assert item_map[product2.id] == 3

    def test_cart_merge_caps_quantity_to_available_stock(self, api_client, user, product3):
        """Test that cart merge caps quantities to available stock."""
        # Guest cart has more items than available stock
        guest_items = [
            {"id": product3.id, "qty": 10}  # Stock is only 5
        ]
        
        api_client.force_authenticate(user=user)
        response = api_client.post('/api/cart/merge/', {
            'guest_items': guest_items
        }, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        
        # Should cap to available stock
        items = response.data['items']
        product3_item = next(item for item in items if item['id'] == product3.id)
        assert product3_item['qty'] == 5
        
        # Should include warning
        assert 'warnings' in response.data
        assert any('stock limit' in warning.lower() for warning in response.data['warnings'])

    def test_cart_merge_removes_out_of_stock_products(self, api_client, user, product1):
        """Test that out-of-stock products are removed during merge."""
        # Create out of stock product
        out_of_stock = ScrapedProduct.objects.create(
            name="Out of Stock Product",
            stock=0,
            price=5000,
            warranty="1 year",
            url="https://example.com/oos",
            category="Phone"
        )
        
        guest_items = [
            {"id": product1.id, "qty": 1},  # In stock
            {"id": out_of_stock.id, "qty": 2}    # Out of stock
        ]
        
        api_client.force_authenticate(user=user)
        response = api_client.post('/api/cart/merge/', {
            'guest_items': guest_items
        }, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        
        # Should only have product1
        items = response.data['items']
        assert len(items) == 1
        assert items[0]['id'] == product1.id
        
        # Should include warning
        assert 'warnings' in response.data
        assert any('out of stock' in warning.lower() for warning in response.data['warnings'])

    def test_cart_merge_removes_non_existent_products(self, api_client, user, product1):
        """Test that non-existent products are removed during merge."""
        guest_items = [
            {"id": product1.id, "qty": 1},
            {"id": 99999, "qty": 2}  # Non-existent product ID
        ]
        
        api_client.force_authenticate(user=user)
        response = api_client.post('/api/cart/merge/', {
            'guest_items': guest_items
        }, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        
        # Should only have product1
        items = response.data['items']
        assert len(items) == 1
        assert items[0]['id'] == product1.id
        
        # Should include warning
        assert 'warnings' in response.data

    def test_cart_merge_with_empty_guest_cart(self, api_client, user, product1):
        """Test that merging with empty guest cart doesn't affect user cart."""
        # User has items in cart
        cart, _ = Cart.objects.get_or_create(user=user)
        cart.items = [{"id": product1.id, "qty": 2}]
        cart.save()
        
        # Empty guest cart
        guest_items = []
        
        api_client.force_authenticate(user=user)
        response = api_client.post('/api/cart/merge/', {
            'guest_items': guest_items
        }, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        
        # User cart should be unchanged
        items = response.data['items']
        assert len(items) == 1
        assert items[0]['id'] == product1.id
        assert items[0]['qty'] == 2

    def test_cart_merge_requires_authentication(self, api_client, product1):
        """Test that cart merge endpoint requires authentication."""
        guest_items = [{"id": product1.id, "qty": 1}]
        
        response = api_client.post('/api/cart/merge/', {
            'guest_items': guest_items
        }, format='json')
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_cart_persists_after_merge(self, api_client, user, product1, product2):
        """Test that merged cart persists in database."""
        guest_items = [
            {"id": product1.id, "qty": 2},
            {"id": product2.id, "qty": 1}
        ]
        
        api_client.force_authenticate(user=user)
        api_client.post('/api/cart/merge/', {
            'guest_items': guest_items
        }, format='json')
        
        # Fetch cart from database
        cart = Cart.objects.get(user=user)
        assert len(cart.items) == 2
        
        # Verify persistence by fetching cart again
        response = api_client.get('/api/cart/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['items']) == 2


# ============================================================================
# Checkout Authentication Tests
# ============================================================================

class TestCheckoutRequiresAuthentication:
    """Test cases ensuring checkout requires authentication."""

    def test_unauthenticated_user_cannot_place_order(self, api_client, test_product):
        """Test that anonymous users cannot place orders."""
        order_data = {
            "items": [
                {"product_id": test_product.id, "quantity": 1}
            ],
            "delivery_address": "123 Test Street",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test User"
            }
        }
        
        response = api_client.post('/api/orders/', order_data, format='json')
        
        # Should require authentication
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_authenticated_user_can_place_order(self, api_client, buyer_user, test_product):
        """Test that authenticated users can place orders."""
        api_client.force_authenticate(user=buyer_user)
        
        order_data = {
            "items": [
                {"product_id": test_product.id, "quantity": 1}
            ],
            "delivery_address": "123 Test Street",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test User"
            }
        }
        
        response = api_client.post('/api/orders/', order_data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert 'id' in response.data
        assert 'invoice' in response.data


# ============================================================================
# Payment Processing Tests
# ============================================================================

class TestPaymentProcessing:
    """Test cases for mock payment processing."""

    def test_payment_approved_for_normal_card(self, api_client, buyer_user, test_product):
        """Test that normal card numbers are approved."""
        api_client.force_authenticate(user=buyer_user)
        
        order_data = {
            "items": [
                {"product_id": test_product.id, "quantity": 1}
            ],
            "delivery_address": "123 Test Street",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test User"
            }
        }
        
        response = api_client.post('/api/orders/', order_data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['payment_status'] == 'APPROVED'
        assert response.data['transaction_id'] is not None
        assert response.data['transaction_id'].startswith('TXN-')

    def test_payment_declined_for_test_card_ending_0000(self, api_client, buyer_user, test_product):
        """Test that cards ending in 0000 are declined."""
        api_client.force_authenticate(user=buyer_user)
        
        order_data = {
            "items": [
                {"product_id": test_product.id, "quantity": 1}
            ],
            "delivery_address": "123 Test Street",
            "payment": {
                "card_number": "1234 5678 9012 0000",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Declined Card"
            }
        }
        
        response = api_client.post('/api/orders/', order_data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'payment' in response.data

    def test_order_not_created_on_payment_failure(self, api_client, buyer_user, test_product):
        """Test that order is not created when payment fails."""
        api_client.force_authenticate(user=buyer_user)
        
        initial_order_count = Order.objects.count()
        
        order_data = {
            "items": [
                {"product_id": test_product.id, "quantity": 1}
            ],
            "delivery_address": "123 Test Street",
            "payment": {
                "card_number": "1234 5678 9012 0000",  # Declined card
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Declined Card"
            }
        }
        
        response = api_client.post('/api/orders/', order_data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        
        # Order count should not increase
        assert Order.objects.count() == initial_order_count

    def test_payment_stores_last_four_digits(self, api_client, buyer_user, test_product):
        """Test that last four digits of card are stored."""
        api_client.force_authenticate(user=buyer_user)
        
        order_data = {
            "items": [
                {"product_id": test_product.id, "quantity": 1}
            ],
            "delivery_address": "123 Test Street",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test User"
            }
        }
        
        response = api_client.post('/api/orders/', order_data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['card_last_four'] == '3456'


# ============================================================================
# Invoice Email Tests
# ============================================================================

class TestInvoiceEmail:
    """Test cases for invoice email with PDF attachment."""

    def test_invoice_created_on_successful_order(self, api_client, customer_user, test_product):
        """Test that invoice is created when order is placed."""
        api_client.force_authenticate(user=customer_user)
        
        order_data = {
            "items": [
                {"product_id": test_product.id, "quantity": 2}
            ],
            "delivery_address": "123 Invoice Street",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test Customer"
            }
        }
        
        response = api_client.post('/api/orders/', order_data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        
        # Check invoice was created
        order_id = response.data['id']
        invoice = Invoice.objects.get(order_id=order_id)
        
        assert invoice is not None
        assert invoice.invoice_number == f"INV-{order_id}"
        assert float(invoice.total_amount) == float(response.data['total_amount'])

    def test_invoice_returned_in_order_response(self, api_client, customer_user, test_product):
        """Test that invoice is included in order creation response."""
        api_client.force_authenticate(user=customer_user)
        
        order_data = {
            "items": [
                {"product_id": test_product.id, "quantity": 1}
            ],
            "delivery_address": "456 Invoice Avenue",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test Customer"
            }
        }
        
        response = api_client.post('/api/orders/', order_data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert 'invoice' in response.data
        assert 'invoice_number' in response.data['invoice']
        assert 'total_amount' in response.data['invoice']
        assert 'issue_date' in response.data['invoice']

    def test_invoice_email_sent_automatically(self, api_client, customer_user, test_product):
        """Test that invoice email is sent automatically after order creation."""
        api_client.force_authenticate(user=customer_user)
        
        # Clear mail outbox
        mail.outbox = []
        
        order_data = {
            "items": [
                {"product_id": test_product.id, "quantity": 1}
            ],
            "delivery_address": "789 Email Test Road",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test Customer"
            }
        }
        
        response = api_client.post('/api/orders/', order_data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        
        # Check that email was sent
        assert len(mail.outbox) == 1
        
        email = mail.outbox[0]
        assert email.to == ['customer@example.com']
        assert 'Invoice' in email.subject
        assert 'INV-' in email.subject
        
        # Check email body
        assert 'Thank you for your order' in email.body
        assert 'Invoice Number' in email.body
        
        # Check that Invoice was marked as sent
        order_id = response.data['id']
        invoice = Invoice.objects.get(order_id=order_id)
        assert invoice.email_sent is True

    def test_invoice_email_has_pdf_attachment(self, api_client, customer_user, test_product):
        """Test that invoice email includes PDF attachment."""
        api_client.force_authenticate(user=customer_user)
        
        mail.outbox = []
        
        order_data = {
            "items": [
                {"product_id": test_product.id, "quantity": 2}
            ],
            "delivery_address": "321 PDF Test Avenue",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test Customer"
            }
        }
        
        response = api_client.post('/api/orders/', order_data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert len(mail.outbox) == 1
        
        email = mail.outbox[0]
        
        # Check for PDF attachment
        assert len(email.attachments) == 1
        
        filename, content, mimetype = email.attachments[0]
        assert filename.startswith('invoice_INV-')
        assert filename.endswith('.pdf')
        assert mimetype == 'application/pdf'
        
        # Check that PDF has content
        assert len(content) > 0
        
        # Verify it's a PDF (starts with PDF magic bytes)
        assert content.startswith(b'%PDF')

    def test_order_succeeds_even_if_email_fails(self, api_client, customer_user, test_product):
        """Test that order is created even if email sending fails."""
        api_client.force_authenticate(user=customer_user)
        
        # Mock email sending to raise an exception
        with patch('orders.serializers.OrderCreateSerializer._send_invoice_email', 
                   side_effect=Exception('Email server error')):
            order_data = {
                "items": [
                    {"product_id": test_product.id, "quantity": 1}
                ],
                "delivery_address": "555 Failure Test Road",
                "payment": {
                    "card_number": "1234 5678 9012 3456",
                    "expiry": "12/25",
                    "cvv": "123",
                    "cardholder_name": "Test Customer"
                }
            }
            
            response = api_client.post('/api/orders/', order_data, format='json')
            
            # Order should still be created
            assert response.status_code == status.HTTP_201_CREATED
            
            # Verify order exists
            order_id = response.data['id']
            order = Order.objects.get(id=order_id)
            assert order.customer == customer_user

    def test_no_email_sent_if_user_has_no_email(self, api_client, test_product):
        """Test that no email is sent if user has no email address."""
        # Create user without email
        user_no_email = User.objects.create_user(
            username="noemail",
            email="",  # No email
            password="testpass123"
        )
        api_client.force_authenticate(user=user_no_email)
        
        mail.outbox = []
        
        order_data = {
            "items": [
                {"product_id": test_product.id, "quantity": 1}
            ],
            "delivery_address": "999 No Email Road",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test Customer"
            }
        }
        
        response = api_client.post('/api/orders/', order_data, format='json')
        
        # Order should still be created
        assert response.status_code == status.HTTP_201_CREATED
        
        # No email should be sent
        assert len(mail.outbox) == 0
        
        # Invoice should still be created but marked as not sent
        order_id = response.data['id']
        invoice = Invoice.objects.get(order_id=order_id)
        assert invoice.email_sent is False

    def test_invoice_contains_correct_order_details(self, api_client, customer_user, test_product):
        """Test that invoice contains all correct order details."""
        api_client.force_authenticate(user=customer_user)
        
        order_data = {
            "items": [
                {"product_id": test_product.id, "quantity": 3}
            ],
            "delivery_address": "111 Details Test Street",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test Customer"
            }
        }
        
        response = api_client.post('/api/orders/', order_data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        
        invoice_data = response.data['invoice']
        
        # Verify invoice number format
        assert invoice_data['invoice_number'].startswith('INV-')
        
        # Verify total matches order total
        assert float(invoice_data['total_amount']) == float(response.data['total_amount'])
        
        # Verify issue date is present
        assert invoice_data['issue_date'] is not None

