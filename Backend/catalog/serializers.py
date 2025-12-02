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

    def validate_rating(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError("Rating must be between 1 and 5.")
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return attrs

        product_id = None
        # Product can come from an explicit field or from the URL kwarg
        if attrs.get("product"):
            product_id = attrs["product"].id
        else:
            product_id = self.context.get("view").kwargs.get("product_id")  # type: ignore[attr-defined]

        if not product_id:
            raise serializers.ValidationError("Product is required for a review.")

        # Allow review only if the user has a paid order (invoice) that contains this product
        from orders.models import Order  # local import to avoid circulars

        has_invoice_for_product = Order.objects.filter(
            customer=request.user,
            payment_status=Order.PaymentStatus.APPROVED,
            invoice__isnull=False,
            items__product_id=product_id,
        ).exists()

        if not has_invoice_for_product:
            raise serializers.ValidationError(
                "You can only review products you have purchased."
            )

        if Review.objects.filter(product_id=product_id, user=request.user).exists():
            raise serializers.ValidationError("You have already reviewed this product.")

        return attrs

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

