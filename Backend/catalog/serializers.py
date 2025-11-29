from rest_framework import serializers
from .models import Category, ScrapedProduct, Review, Wishlist


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


# 🔥 REVIEW SERIALIZER
class ReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = Review
        fields = ["id", "user", "user_name", "rating", "comment", "created_at"]
        read_only_fields = ["id", "user", "created_at"]

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)


# 🔥 ÜRÜN DETAYI + ORTALAMA RATING
class ProductDetailSerializer(serializers.ModelSerializer):
    brand = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    avg_rating = serializers.FloatField(read_only=True)
    review_count = serializers.IntegerField(read_only=True)

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
            "avg_rating",
            "review_count",
        ]

    def get_brand(self, obj):
        return obj.distributer or ""

    def get_image_url(self, _obj):
        return None


class WishlistSerializer(serializers.ModelSerializer):
    class Meta:
        model = Wishlist
        fields = ["product_ids"]

