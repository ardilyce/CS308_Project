from django.contrib.auth.models import User
from django.contrib.postgres.fields import JSONField
from django.db import models


class Cart(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="cart")
    items = models.JSONField(default=list)  # [{ "id": 5, "qty": 3 }]
