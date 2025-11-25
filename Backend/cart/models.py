from django.contrib.auth.models import User
from django.contrib.postgres.fields import ArrayField
from django.db import models


class Cart(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    items = ArrayField(base_field=models.IntegerField(), default=list, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username}'s Cart"
