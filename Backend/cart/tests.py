from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from catalog.models import ScrapedProduct
from cart.models import Cart

User = get_user_model()


class AnonymousBrowsingTests(TestCase):
    """Test cases for browsing products without authentication"""

    def setUp(self):
        """Set up test client and create test data"""
        self.client = APIClient()
        
        # Create test products
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

    def test_unauthenticated_user_can_view_product_list(self):
        """Test that anonymous users can browse product catalog"""
        response = self.client.get('/api/products/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Handle paginated response
        if isinstance(response.data, dict) and 'results' in response.data:
            results = response.data['results']
        else:
            results = response.data
        
        self.assertGreater(len(results), 0)
        self.assertTrue(any(p['name'] == "iPhone 15 Pro" for p in results))

    def test_unauthenticated_user_can_view_product_detail(self):
        """Test that anonymous users can view product details"""
        response = self.client.get(f'/api/products/{self.product1.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], "iPhone 15 Pro")
        self.assertEqual(response.data['stock'], 10)
        self.assertEqual(response.data['price'], 50000)

    def test_unauthenticated_user_can_search_products(self):
        """Test that anonymous users can search for products"""
        response = self.client.get('/api/products/?search=iPhone')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Handle paginated response
        if isinstance(response.data, dict) and 'results' in response.data:
            results = response.data['results']
        else:
            results = response.data
        
        # Should find iPhone product
        self.assertTrue(any('iPhone' in p['name'] for p in results))

    def test_unauthenticated_user_can_filter_by_category(self):
        """Test that anonymous users can filter products by category"""
        # First, create a category to filter by
        from catalog.models import Category
        phone_category = Category.objects.create(
            name="Phone",
            slug="phone"
        )
        
        response = self.client.get('/api/products/?category=phone')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Handle paginated response
        if isinstance(response.data, dict) and 'results' in response.data:
            results = response.data['results']
        else:
            results = response.data
        
        self.assertGreater(len(results), 0)

    def test_unauthenticated_user_cannot_access_cart(self):
        """Test that anonymous users cannot access backend cart endpoint"""
        response = self.client.get('/api/cart/')
        
        # Should require authentication
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_unauthenticated_user_cannot_add_to_backend_cart(self):
        """Test that anonymous users cannot add to backend cart directly"""
        response = self.client.post('/api/cart/add/', {
            'product_id': self.product1.id
        }, format='json')
        
        # Should require authentication
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class CartMergeOnLoginTests(TestCase):
    """Test cases for cart merging when user logs in after adding items as guest"""

    def setUp(self):
        """Set up test client and create test data"""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        
        # Create test products
        self.product1 = ScrapedProduct.objects.create(
            name="Product 1",
            stock=20,
            price=10000,
            warranty="1 year",
            url="https://example.com/p1",
            category="Phone"
        )
        
        self.product2 = ScrapedProduct.objects.create(
            name="Product 2",
            stock=15,
            price=15000,
            warranty="1 year",
            url="https://example.com/p2",
            category="Phone"
        )
        
        self.product3 = ScrapedProduct.objects.create(
            name="Product 3",
            stock=5,
            price=20000,
            warranty="1 year",
            url="https://example.com/p3",
            category="Phone"
        )

    def test_guest_cart_merged_with_empty_user_cart(self):
        """Test that guest cart items are merged when user logs in with empty cart"""
        # Simulate guest cart items (what would come from localStorage)
        guest_items = [
            {"id": self.product1.id, "qty": 2},
            {"id": self.product2.id, "qty": 1}
        ]
        
        # User logs in and merges cart
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/cart/merge/', {
            'guest_items': guest_items
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('items', response.data)
        
        # Verify merged items
        items = response.data['items']
        self.assertEqual(len(items), 2)
        
        # Check quantities are preserved
        item_map = {item['id']: item['qty'] for item in items}
        self.assertEqual(item_map[self.product1.id], 2)
        self.assertEqual(item_map[self.product2.id], 1)

    def test_guest_cart_merged_with_existing_user_cart(self):
        """Test that guest cart items are combined with existing user cart"""
        # User already has items in backend cart
        cart, _ = Cart.objects.get_or_create(user=self.user)
        cart.items = [{"id": self.product1.id, "qty": 1}]
        cart.save()
        
        # Guest cart has same product and a new product
        guest_items = [
            {"id": self.product1.id, "qty": 2},  # Will be added to existing
            {"id": self.product2.id, "qty": 3}   # New product
        ]
        
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/cart/merge/', {
            'guest_items': guest_items
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify quantities were summed
        items = response.data['items']
        item_map = {item['id']: item['qty'] for item in items}
        
        # Product 1: 1 (backend) + 2 (guest) = 3
        self.assertEqual(item_map[self.product1.id], 3)
        # Product 2: 0 (backend) + 3 (guest) = 3
        self.assertEqual(item_map[self.product2.id], 3)

    def test_cart_merge_caps_quantity_to_available_stock(self):
        """Test that cart merge caps quantities to available stock"""
        # Guest cart has more items than available stock
        guest_items = [
            {"id": self.product3.id, "qty": 10}  # Stock is only 5
        ]
        
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/cart/merge/', {
            'guest_items': guest_items
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Should cap to available stock
        items = response.data['items']
        product3_item = next(item for item in items if item['id'] == self.product3.id)
        self.assertEqual(product3_item['qty'], 5)
        
        # Should include warning
        self.assertIn('warnings', response.data)
        self.assertTrue(any('stock limit' in warning.lower() for warning in response.data['warnings']))

    def test_cart_merge_removes_out_of_stock_products(self):
        """Test that out-of-stock products are removed during merge"""
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
            {"id": self.product1.id, "qty": 1},  # In stock
            {"id": out_of_stock.id, "qty": 2}    # Out of stock
        ]
        
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/cart/merge/', {
            'guest_items': guest_items
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Should only have product1
        items = response.data['items']
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['id'], self.product1.id)
        
        # Should include warning
        self.assertIn('warnings', response.data)
        self.assertTrue(any('out of stock' in warning.lower() for warning in response.data['warnings']))

    def test_cart_merge_removes_non_existent_products(self):
        """Test that non-existent products are removed during merge"""
        guest_items = [
            {"id": self.product1.id, "qty": 1},
            {"id": 99999, "qty": 2}  # Non-existent product ID
        ]
        
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/cart/merge/', {
            'guest_items': guest_items
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Should only have product1
        items = response.data['items']
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['id'], self.product1.id)
        
        # Should include warning
        self.assertIn('warnings', response.data)

    def test_cart_merge_with_empty_guest_cart(self):
        """Test that merging with empty guest cart doesn't affect user cart"""
        # User has items in cart
        cart, _ = Cart.objects.get_or_create(user=self.user)
        cart.items = [{"id": self.product1.id, "qty": 2}]
        cart.save()
        
        # Empty guest cart
        guest_items = []
        
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/cart/merge/', {
            'guest_items': guest_items
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # User cart should be unchanged
        items = response.data['items']
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['id'], self.product1.id)
        self.assertEqual(items[0]['qty'], 2)

    def test_cart_merge_requires_authentication(self):
        """Test that cart merge endpoint requires authentication"""
        guest_items = [{"id": self.product1.id, "qty": 1}]
        
        response = self.client.post('/api/cart/merge/', {
            'guest_items': guest_items
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_cart_persists_after_merge(self):
        """Test that merged cart persists in database"""
        guest_items = [
            {"id": self.product1.id, "qty": 2},
            {"id": self.product2.id, "qty": 1}
        ]
        
        self.client.force_authenticate(user=self.user)
        self.client.post('/api/cart/merge/', {
            'guest_items': guest_items
        }, format='json')
        
        # Fetch cart from database
        cart = Cart.objects.get(user=self.user)
        self.assertEqual(len(cart.items), 2)
        
        # Verify persistence by fetching cart again
        response = self.client.get('/api/cart/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['items']), 2)


class CheckoutRequiresAuthenticationTests(TestCase):
    """Test cases ensuring checkout requires authentication"""

    def setUp(self):
        """Set up test client and create test data"""
        self.client = APIClient()
        self.product = ScrapedProduct.objects.create(
            name="Test Product",
            stock=10,
            price=10000,
            warranty="1 year",
            url="https://example.com/test",
            category="Phone"
        )

    def test_unauthenticated_user_cannot_place_order(self):
        """Test that anonymous users cannot place orders"""
        order_data = {
            "items": [
                {"product_id": self.product.id, "quantity": 1}
            ],
            "delivery_address": "123 Test Street",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test User"
            }
        }
        
        response = self.client.post('/api/orders/', order_data, format='json')
        
        # Should require authentication
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_user_can_place_order(self):
        """Test that authenticated users can place orders"""
        user = User.objects.create_user(
            username="buyer",
            email="buyer@example.com",
            password="buyerpass123"
        )
        self.client.force_authenticate(user=user)
        
        order_data = {
            "items": [
                {"product_id": self.product.id, "quantity": 1}
            ],
            "delivery_address": "123 Test Street",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test User"
            }
        }
        
        response = self.client.post('/api/orders/', order_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('id', response.data)
        self.assertIn('invoice', response.data)


class PaymentProcessingTests(TestCase):
    """Test cases for mock payment processing"""

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

    def test_payment_approved_for_normal_card(self):
        """Test that normal card numbers are approved"""
        order_data = {
            "items": [
                {"product_id": self.product.id, "quantity": 1}
            ],
            "delivery_address": "123 Test Street",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test User"
            }
        }
        
        response = self.client.post('/api/orders/', order_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['payment_status'], 'APPROVED')
        self.assertIsNotNone(response.data['transaction_id'])
        self.assertTrue(response.data['transaction_id'].startswith('TXN-'))

    def test_payment_declined_for_test_card_ending_0000(self):
        """Test that cards ending in 0000 are declined"""
        order_data = {
            "items": [
                {"product_id": self.product.id, "quantity": 1}
            ],
            "delivery_address": "123 Test Street",
            "payment": {
                "card_number": "1234 5678 9012 0000",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Declined Card"
            }
        }
        
        response = self.client.post('/api/orders/', order_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('payment', response.data)

    def test_order_not_created_on_payment_failure(self):
        """Test that order is not created when payment fails"""
        from orders.models import Order
        
        initial_order_count = Order.objects.count()
        
        order_data = {
            "items": [
                {"product_id": self.product.id, "quantity": 1}
            ],
            "delivery_address": "123 Test Street",
            "payment": {
                "card_number": "1234 5678 9012 0000",  # Declined card
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Declined Card"
            }
        }
        
        response = self.client.post('/api/orders/', order_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
        # Order count should not increase
        self.assertEqual(Order.objects.count(), initial_order_count)

    def test_payment_stores_last_four_digits(self):
        """Test that last four digits of card are stored"""
        order_data = {
            "items": [
                {"product_id": self.product.id, "quantity": 1}
            ],
            "delivery_address": "123 Test Street",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test User"
            }
        }
        
        response = self.client.post('/api/orders/', order_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['card_last_four'], '3456')


class InvoiceEmailTests(TestCase):
    """Test cases for invoice email with PDF attachment"""

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
            name="Test Product",
            stock=20,
            price=10000,
            warranty="1 year",
            url="https://example.com/test",
            category="Phone"
        )

    def test_invoice_created_on_successful_order(self):
        """Test that invoice is created when order is placed"""
        from orders.models import Invoice
        
        order_data = {
            "items": [
                {"product_id": self.product.id, "quantity": 2}
            ],
            "delivery_address": "123 Invoice Street",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test Customer"
            }
        }
        
        response = self.client.post('/api/orders/', order_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Check invoice was created
        order_id = response.data['id']
        invoice = Invoice.objects.get(order_id=order_id)
        
        self.assertIsNotNone(invoice)
        self.assertEqual(invoice.invoice_number, f"INV-{order_id}")
        self.assertEqual(float(invoice.total_amount), float(response.data['total_amount']))

    def test_invoice_returned_in_order_response(self):
        """Test that invoice is included in order creation response"""
        order_data = {
            "items": [
                {"product_id": self.product.id, "quantity": 1}
            ],
            "delivery_address": "456 Invoice Avenue",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test Customer"
            }
        }
        
        response = self.client.post('/api/orders/', order_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('invoice', response.data)
        self.assertIn('invoice_number', response.data['invoice'])
        self.assertIn('total_amount', response.data['invoice'])
        self.assertIn('issue_date', response.data['invoice'])

    def test_invoice_email_sent_automatically(self):
        """Test that invoice email is sent automatically after order creation"""
        from django.core import mail
        from orders.models import Invoice
        
        # Clear mail outbox
        mail.outbox = []
        
        order_data = {
            "items": [
                {"product_id": self.product.id, "quantity": 1}
            ],
            "delivery_address": "789 Email Test Road",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test Customer"
            }
        }
        
        response = self.client.post('/api/orders/', order_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Check that email was sent
        self.assertEqual(len(mail.outbox), 1)
        
        email = mail.outbox[0]
        self.assertEqual(email.to, ['customer@example.com'])
        self.assertIn('Invoice', email.subject)
        self.assertIn('INV-', email.subject)
        
        # Check email body
        self.assertIn('Thank you for your order', email.body)
        self.assertIn('Invoice Number', email.body)
        
        # Check that Invoice was marked as sent
        order_id = response.data['id']
        invoice = Invoice.objects.get(order_id=order_id)
        self.assertTrue(invoice.email_sent)

    def test_invoice_email_has_pdf_attachment(self):
        """Test that invoice email includes PDF attachment"""
        from django.core import mail
        
        mail.outbox = []
        
        order_data = {
            "items": [
                {"product_id": self.product.id, "quantity": 2}
            ],
            "delivery_address": "321 PDF Test Avenue",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test Customer"
            }
        }
        
        response = self.client.post('/api/orders/', order_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(mail.outbox), 1)
        
        email = mail.outbox[0]
        
        # Check for PDF attachment
        self.assertEqual(len(email.attachments), 1)
        
        filename, content, mimetype = email.attachments[0]
        self.assertTrue(filename.startswith('invoice_INV-'))
        self.assertTrue(filename.endswith('.pdf'))
        self.assertEqual(mimetype, 'application/pdf')
        
        # Check that PDF has content
        self.assertGreater(len(content), 0)
        
        # Verify it's a PDF (starts with PDF magic bytes)
        self.assertTrue(content.startswith(b'%PDF'))

    def test_order_succeeds_even_if_email_fails(self):
        """Test that order is created even if email sending fails"""
        from unittest.mock import patch
        from orders.models import Order
        
        # Mock email sending to raise an exception
        with patch('orders.serializers.OrderCreateSerializer._send_invoice_email', 
                   side_effect=Exception('Email server error')):
            order_data = {
                "items": [
                    {"product_id": self.product.id, "quantity": 1}
                ],
                "delivery_address": "555 Failure Test Road",
                "payment": {
                    "card_number": "1234 5678 9012 3456",
                    "expiry": "12/25",
                    "cvv": "123",
                    "cardholder_name": "Test Customer"
                }
            }
            
            response = self.client.post('/api/orders/', order_data, format='json')
            
            # Order should still be created
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            
            # Verify order exists
            order_id = response.data['id']
            order = Order.objects.get(id=order_id)
            self.assertEqual(order.customer, self.user)

    def test_no_email_sent_if_user_has_no_email(self):
        """Test that no email is sent if user has no email address"""
        from django.core import mail
        from orders.models import Invoice
        
        # Create user without email
        user_no_email = User.objects.create_user(
            username="noemail",
            email="",  # No email
            password="testpass123"
        )
        self.client.force_authenticate(user=user_no_email)
        
        mail.outbox = []
        
        order_data = {
            "items": [
                {"product_id": self.product.id, "quantity": 1}
            ],
            "delivery_address": "999 No Email Road",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test Customer"
            }
        }
        
        response = self.client.post('/api/orders/', order_data, format='json')
        
        # Order should still be created
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # No email should be sent
        self.assertEqual(len(mail.outbox), 0)
        
        # Invoice should still be created but marked as not sent
        order_id = response.data['id']
        invoice = Invoice.objects.get(order_id=order_id)
        self.assertFalse(invoice.email_sent)

    def test_invoice_contains_correct_order_details(self):
        """Test that invoice contains all correct order details"""
        order_data = {
            "items": [
                {"product_id": self.product.id, "quantity": 3}
            ],
            "delivery_address": "111 Details Test Street",
            "payment": {
                "card_number": "1234 5678 9012 3456",
                "expiry": "12/25",
                "cvv": "123",
                "cardholder_name": "Test Customer"
            }
        }
        
        response = self.client.post('/api/orders/', order_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        invoice_data = response.data['invoice']
        
        # Verify invoice number format
        self.assertTrue(invoice_data['invoice_number'].startswith('INV-'))
        
        # Verify total matches order total
        self.assertEqual(
            float(invoice_data['total_amount']), 
            float(response.data['total_amount'])
        )
        
        # Verify issue date is present
        self.assertIsNotNone(invoice_data['issue_date'])
