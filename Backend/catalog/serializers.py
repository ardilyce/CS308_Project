from rest_framework import serializers
from .models import Category,Product

class ProductSerializer(serializers.ModelSerializer):
    category = serializers.CharField(source="category.slug", read_only=True)

    class Meta:
        model = Product
        fields = ["id", "name", "brand", "price", "stock", "description", "image_url", "category"]

class CategorySerializer(serializers.ModelSerializer):
    products = ProductSerializer(many=True, read_only=True)

    class Meta:
        model = Category
        fields = ["id", "name", "slug", "products"]