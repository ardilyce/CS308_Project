from django.contrib import admin
from .models import CustomerProfile

@admin.register(CustomerProfile)
class CustomerProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "tax_id", "home_address", "card_number")
    search_fields = ("user__username", "user__email", "tax_id")

