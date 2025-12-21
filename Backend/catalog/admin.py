from django.contrib import admin
from .models import Category, ScrapedProduct, Review, Wishlist


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
        "discount",
        "discount_percentage",
        "stock",
        "category",
    )
    list_filter = ("category", "distributer")
    search_fields = ("name", "model", "serialnumber", "distributer")


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("id", "product", "user", "rating", "created_at")
    list_filter = ("rating", "created_at")
    search_fields = ("product__name", "user__username")

@admin.register(Wishlist)
class WishlistAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "product_ids")
    search_fields = ("user__username", "user__email")

