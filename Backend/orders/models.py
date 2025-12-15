from django.conf import settings
from django.db import models
from catalog.models import ScrapedProduct as Product
from backend.encryption import encrypt_field, decrypt_field

User = settings.AUTH_USER_MODEL


class Order(models.Model):
    """
    Order model with encrypted delivery address for PII protection.
    """
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PROCESSING = "PROCESSING", "Processing"
        PAID = "PAID", "Paid"
        SHIPPED = "SHIPPED", "Shipped"
        DELIVERED = "DELIVERED", "Delivered"
        CANCELLED = "CANCELLED", "Cancelled"

    class PaymentStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        DECLINED = "DECLINED", "Declined"
        REFUNDED = "REFUNDED", "Refunded"

    customer = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="orders",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )

    # Payment fields
    payment_status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
    )
    transaction_id = models.CharField(max_length=100, blank=True, null=True)
    card_last_four = models.CharField(max_length=4, blank=True, null=True)

    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)

    # Encrypted delivery address (PII)
    _delivery_address_encrypted = models.TextField(db_column='delivery_address')

    created_at = models.DateTimeField(auto_now_add=True)  # 🔥 tarih
    updated_at = models.DateTimeField(auto_now=True)
    
    @property
    def delivery_address(self) -> str:
        """Get decrypted delivery address."""
        return decrypt_field(self._delivery_address_encrypted)
    
    @delivery_address.setter
    def delivery_address(self, value: str):
        """Set and encrypt delivery address."""
        self._delivery_address_encrypted = encrypt_field(value) if value else ""

    def __str__(self):
        return f"Order #{self.id} - {self.customer}"


class OrderItem(models.Model):
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="items",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
    )

    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    line_total = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.product} x {self.quantity}"


class Invoice(models.Model):
    order = models.OneToOneField(
        Order,
        on_delete=models.CASCADE,
        related_name="invoice",
    )
    invoice_number = models.CharField(max_length=50, unique=True)
    issue_date = models.DateTimeField(auto_now_add=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Email tracking field
    email_sent = models.BooleanField(default=False)

    def __str__(self):
        return self.invoice_number


class Delivery(models.Model):
    """
    Delivery tracking with encrypted address for PII protection.
    
    Fields:
    - delivery ID      -> id
    - customer ID      -> customer (FK)
    - product ID       -> product (FK)
    - quantity         -> quantity
    - total price      -> total_price
    - delivery address -> delivery_address (encrypted)
    - completed?       -> is_completed
    - order            -> parent order
    - created_at, delivered_at timestamps
    """
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="deliveries",
    )
    customer = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="deliveries",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="deliveries",
    )

    quantity = models.PositiveIntegerField()
    total_price = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Encrypted delivery address (PII)
    _delivery_address_encrypted = models.TextField(db_column='delivery_address')

    is_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    
    @property
    def delivery_address(self) -> str:
        """Get decrypted delivery address."""
        return decrypt_field(self._delivery_address_encrypted)
    
    @delivery_address.setter
    def delivery_address(self, value: str):
        """Set and encrypt delivery address."""
        self._delivery_address_encrypted = encrypt_field(value) if value else ""

    def __str__(self):
        return f"Delivery #{self.id} for Order #{self.order_id} - {self.product} x {self.quantity}"


