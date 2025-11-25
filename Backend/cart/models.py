from django.contrib.auth.models import User
from django.db import models


class Cart(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    items = models.JSONField(default=list, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
