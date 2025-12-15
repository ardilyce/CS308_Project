from django.conf import settings
from django.db import models


class UserProfile(models.Model):
    """
    User profile model supporting multiple roles as per CS308 project requirements:
    - Customer: browse, purchase, comment, rate products
    - Sales Manager: set prices, manage discounts, view invoices, calculate revenue
    - Product Manager: add/remove products, manage stock, approve comments, manage deliveries
    - Support Agent: provide real-time chat assistance to customers
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

    # Customer-specific fields
    tax_id = models.CharField(max_length=50, blank=True)
    home_address = models.TextField(blank=True)
    card_number = models.CharField(max_length=32, blank=True)  # encrypted credit card

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

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

