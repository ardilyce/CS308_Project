from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.db import models
from django.utils.text import slugify
from django.core.validators import MaxValueValidator, MinValueValidator


class Category(models.Model):
    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class ScrapedProduct(models.Model):
    name = models.CharField(max_length=255)
    model = models.CharField(max_length=255, null=True, blank=True)
    serialnumber = models.CharField(max_length=255, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    stock = models.IntegerField()
    price = models.IntegerField()
    cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    warranty = models.CharField(max_length=50)
    distributer = models.CharField(max_length=255, null=True, blank=True)
    url = models.TextField(unique=True)
    category = models.CharField(max_length=50, default="Phone")
    cloudinary_image_url = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    discount = models.BooleanField(default=False)
    discount_percentage = models.PositiveSmallIntegerField(null=True,blank=True,validators=[MinValueValidator(0),MaxValueValidator(100)])

    class Meta:
        indexes = [
            models.Index(fields=["category", "distributer"]),
        ]
        ordering = ["-id"]

    def __str__(self):
        return self.name

    @property
    def brand(self):
        return self.distributer or ""

    @property
    def image_url(self):
        """Return Cloudinary URL for the product image when available."""
        if self.cloudinary_image_url:
            return self.cloudinary_image_url

        # Fallback to local media (legacy uploads).
        import os

        from django.conf import settings

        # Ensure MEDIA_URL has proper format (with leading slash)
        media_url = settings.MEDIA_URL
        if not media_url.startswith("/"):
            media_url = "/" + media_url

        # Check for PNG first, then WEBP
        for ext in ["png", "webp"]:
            image_path = os.path.join(
                settings.MEDIA_ROOT, "products", f"{self.id}.{ext}"
            )
            if os.path.exists(image_path):
                return f"{media_url}products/{self.id}.{ext}"
        return None

    @property
    def discounted_price(self):
        if not self.discount or self.discount_percentage is None:
            return Decimal(self.price)

        percentage = int(self.discount_percentage)
        if percentage <= 0:
            return Decimal(self.price)
        if percentage >= 100:
            return Decimal("0")

        multiplier = (Decimal("100") - Decimal(percentage)) / Decimal("100")
        return (Decimal(self.price) * multiplier).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )


# COMMENT + RATING (REVIEW)
class Review(models.Model):
    product = models.ForeignKey(
        ScrapedProduct,
        on_delete=models.CASCADE,
        related_name="reviews",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reviews",
    )
    rating = models.PositiveSmallIntegerField()  # 1-5 range
    comment = models.TextField(blank=True)
    flag = models.BooleanField(default=False)  # approved/visible
    rejected = models.BooleanField(
        default=False
    )  # when managers reject, keep rating but hide comment
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("product", "user")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.product.name} - {self.user} ({self.rating})"


class Wishlist(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="wishlist",
    )
    # sadece product_id'lerin listesi (array)
    product_ids = ArrayField(
        base_field=models.IntegerField(),
        default=list,
        blank=True,
    )

    def __str__(self):
        return f"Wishlist of {self.user.username}"
