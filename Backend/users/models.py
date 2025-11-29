from django.conf import settings
from django.db import models


class CustomerProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )

    tax_id = models.CharField(max_length=50, blank=True)
    home_address = models.TextField(blank=True)
    card_number = models.CharField(max_length=32, blank=True)  # full kredi kartı

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Profile of {self.user.username}"

