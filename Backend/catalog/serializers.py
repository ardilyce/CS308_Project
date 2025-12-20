from rest_framework import serializers

from .models import Category, Review, ScrapedProduct, Wishlist


class ScrapedProductSerializer(serializers.ModelSerializer):
    brand = serializers.CharField(source="distributer", allow_blank=True, required=False)
    image_url = serializers.ReadOnlyField()  # Uses model's image_url property
    image = serializers.ImageField(write_only=True, required=False)

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
            "image",
        ]
        extra_kwargs = {
            "url": {"required": False, "allow_blank": True},
            "id": {"read_only": False, "required": False},
        }

    def create(self, validated_data):
        # Remove 'image' if present, as it's handled manually in the view
        validated_data.pop("image", None)
        return super().create(validated_data)


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug"]


# 🔥 REVIEW SERIALIZER
class ReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.username", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    flag = serializers.BooleanField(read_only=True)
    comment_visible = serializers.SerializerMethodField()
    rejected = serializers.BooleanField(read_only=True)

    class Meta:
        model = Review
        fields = [
            "id",
            "product",
            "product_name",
            "user",
            "user_name",
            "rating",
            "comment",
            "flag",
            "created_at",
            "comment_visible",
            "rejected",
        ]
        read_only_fields = ["id", "user", "flag", "created_at", "product"]

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

        # Disallow multiple reviews, except allow adding a comment later if it was blank
        existing = Review.objects.filter(
            product_id=product_id, user=request.user
        ).first()
        incoming_comment = (attrs.get("comment") or "").strip()
        if existing:
            if (
                not existing.rejected
                and existing.comment.strip() == ""
                and incoming_comment
            ):
                # Allow upgrading a rating-only review with a first-time comment
                return attrs
            raise serializers.ValidationError("You have already reviewed this product.")

        return attrs

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)

    def get_comment_visible(self, obj):
        # Managers can always see comments when explicitly enabled via context.
        show_unapproved = self.context.get("show_unapproved_comment", False)
        return bool(obj.flag or show_unapproved)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        show_unapproved = self.context.get("show_unapproved_comment", False)
        # Hide comment text until approved (unless explicitly allowed)
        if (not instance.flag or instance.rejected) and not show_unapproved:
            data["comment"] = ""
        return data


class ReviewFlagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = ["flag"]


# 🔥 ÜRÜN DETAYI + ORTALAMA RATING
class ProductDetailSerializer(serializers.ModelSerializer):
    brand = serializers.SerializerMethodField()
    image_url = serializers.ReadOnlyField()  # Uses model's image_url property
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


class WishlistSerializer(serializers.ModelSerializer):
    class Meta:
        model = Wishlist
        fields = ["product_ids"]
