from django.conf import settings
from django.db import models

from backend.encryption import encrypt_field, decrypt_field


class UserProfile(models.Model):
    """
    User profile model supporting multiple roles as per CS308 project requirements:
    - Customer: browse, purchase, comment, rate products
    - Sales Manager: set prices, manage discounts, view invoices, calculate revenue
    - Product Manager: add/remove products, manage stock, approve comments, manage deliveries
    - Support Agent: provide real-time chat assistance to customers
    
    Sensitive fields (tax_id, home_address, card_number) are encrypted at rest
    using Fernet symmetric encryption.
    """
    
    class Role(models.TextChoices):
        CUSTOMER = 'customer', 'Customer'
        SALES_MANAGER = 'sales_manager', 'Sales Manager'
        PRODUCT_MANAGER = 'product_manager', 'Product Manager'
        SUPPORT_AGENT = 'support_agent', 'Support Agent'
    
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.CUSTOMER,
    )

    # Customer-specific fields - stored encrypted
    # Using larger max_length to accommodate encrypted data (base64 encoding expands size)
    _tax_id_encrypted = models.CharField(max_length=255, blank=True, db_column='tax_id')
    _home_address_encrypted = models.TextField(blank=True, db_column='home_address')
    _card_number_encrypted = models.CharField(max_length=255, blank=True, db_column='card_number')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Properties for transparent encryption/decryption
    @property
    def tax_id(self) -> str:
        """Get decrypted tax ID."""
        return decrypt_field(self._tax_id_encrypted)
    
    @tax_id.setter
    def tax_id(self, value: str):
        """Set and encrypt tax ID."""
        self._tax_id_encrypted = encrypt_field(value) if value else ""
    
    @property
    def home_address(self) -> str:
        """Get decrypted home address."""
        return decrypt_field(self._home_address_encrypted)
    
    @home_address.setter
    def home_address(self, value: str):
        """Set and encrypt home address."""
        self._home_address_encrypted = encrypt_field(value) if value else ""
    
    @property
    def card_number(self) -> str:
        """Get decrypted card number."""
        return decrypt_field(self._card_number_encrypted)
    
    @card_number.setter
    def card_number(self, value: str):
        """Set and encrypt card number."""
        self._card_number_encrypted = encrypt_field(value) if value else ""

    class Meta:
        verbose_name = 'User Profile'
        verbose_name_plural = 'User Profiles'

    def __str__(self):
        return f"{self.user.username} ({self.get_role_display()})"
    
    # Role check helper methods
    @property
    def is_customer(self):
        return self.role == self.Role.CUSTOMER
    
    @property
    def is_sales_manager(self):
        return self.role == self.Role.SALES_MANAGER
    
    @property
    def is_product_manager(self):
        return self.role == self.Role.PRODUCT_MANAGER
    
    @property
    def is_support_agent(self):
        return self.role == self.Role.SUPPORT_AGENT
    
    @property
    def is_staff_role(self):
        """Returns True if user has any management/staff role"""
        return self.role in [
            self.Role.SALES_MANAGER,
            self.Role.PRODUCT_MANAGER,
            self.Role.SUPPORT_AGENT,
        ]

