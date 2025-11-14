from django.contrib import admin
from .models import Category, ScrapedProduct

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "slug")
    prepopulated_fields = {"slug": ("name",)}

@admin.register(ScrapedProduct)
class ScrapedProductAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "distributer",
        "price",
        "stock",
        "category",
    )
    list_filter = ("category", "distributer")
    search_fields = ("name", "model", "serialnumber", "distributer")
