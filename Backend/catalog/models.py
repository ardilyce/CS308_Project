from django.db import models
from django.utils.text import slugify 

class Category(models.Model):
    name = models.CharField(max_length = 120, unique = True)
    slug = models.SlugField(max_length = 140, unique = True, blank = True)

    def save(self,*args,**kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args,**kwargs)

    def __str__(self):
        return self.name

class Product(models.Model):
    category = models.ForeignKey(Category,on_delete=models.CASCADE,related_name = "products")
    name = models.CharField(max_length = 200)
    brand = models.CharField(max_length = 200, blank = True)
    price = models.DecimalField(max_digits = 12,decimal_places = 2)
    stock = models.PositiveIntegerField(default = 0)
    description = models.TextField(blank=True)
    image_url = models.URLField(blank=True)
    class Meta:
        indexes = [
            models.Index(fields=["category", "brand"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.category.name})"
    
from django.db import models

class ScrapedProduct(models.Model):
    name = models.CharField(max_length=255)
    model = models.CharField(max_length=255, null=True, blank=True)
    serialnumber = models.CharField(max_length=255, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    stock = models.IntegerField()
    price = models.IntegerField()
    warranty = models.CharField(max_length=50)
    distributer = models.CharField(max_length=255, null=True, blank=True)
    url = models.TextField(unique=True)
    category = models.CharField(max_length=50, default="Phone")



    def __str__(self):
        return self.name
