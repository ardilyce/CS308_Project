from rest_framework import serializers
from .models import Category, ScrapedProduct


class ScrapedProductSerializer(serializers.ModelSerializer):
    brand = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ScrapedProduct
        fields = [
            "id",
            "name",
            "brand",
            "price",
            "stock",
            "description",
            "category",
            "model",
            "serialnumber",
            "warranty",
            "url",
            "image_url",
        ]

    def get_brand(self, obj):
        return obj.distributer or ""

    def get_image_url(self, _obj):
        return None


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug"]
