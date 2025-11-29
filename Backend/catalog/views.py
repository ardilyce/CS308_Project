from django.db.models import Avg, Count
from rest_framework import filters, generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import Category, Review, ScrapedProduct, Wishlist
from .serializers import (
    CategorySerializer,
    ProductDetailSerializer,
    ReviewSerializer,
    ScrapedProductSerializer,
    WishlistSerializer,
)


class CategoryList(generics.ListAPIView):
    queryset = Category.objects.all().order_by("id")
    serializer_class = CategorySerializer


class CategoryDetail(generics.RetrieveAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    lookup_field = "slug"


class ProductList(generics.ListAPIView):
    serializer_class = ScrapedProductSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "model", "serialnumber", "distributer", "category"]

    def get_queryset(self):
        qs = ScrapedProduct.objects.all()
        cat = self.request.query_params.get("category")
        brand = self.request.query_params.get("brand")
        if cat:
            category = Category.objects.filter(slug=cat).first()
            if category:
                qs = qs.filter(category__iexact=category.name)
            else:
                qs = qs.none()
        if brand:
            qs = qs.filter(distributer__iexact=brand)
        return qs.order_by("-id")


# ÜRÜN DETAYI + ORTALAMA RATING
class ProductDetail(generics.RetrieveAPIView):
    queryset = ScrapedProduct.objects.all().annotate(
        avg_rating=Avg("reviews__rating"),
        review_count=Count("reviews"),
    )
    serializer_class = ProductDetailSerializer


# REVIEW LIST + CREATE
class ProductReviewListCreateView(generics.ListCreateAPIView):
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        product_id = self.kwargs["product_id"]
        return Review.objects.filter(product_id=product_id)

    def perform_create(self, serializer):
        product_id = self.kwargs["product_id"]
        serializer.save(product_id=product_id, user=self.request.user)


# WISHLIST LIST
class WishlistView(generics.RetrieveUpdateAPIView):
    """
    GET  /api/wishlist/  → product_ids listesini getir
    PUT  /api/wishlist/  → product_ids listesini güncelle
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = WishlistSerializer

    def get_object(self):
        wishlist, _ = Wishlist.objects.get_or_create(user=self.request.user)
        return wishlist


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def wishlist_toggle(request):
    product_id = request.data.get("product_id")

    if not product_id:
        return Response({"error": "product_id required"}, status=400)

    try:
        product_id = int(product_id)
    except ValueError:
        return Response({"error": "product_id must be an integer"}, status=400)

    wishlist, _ = Wishlist.objects.get_or_create(user=request.user)

    if product_id in wishlist.product_ids:
        wishlist.product_ids.remove(product_id)
        wishlist.save()
        return Response({"in_wishlist": False, "product_ids": wishlist.product_ids})

    wishlist.product_ids.append(product_id)
    wishlist.save()

    return Response({"in_wishlist": True, "product_ids": wishlist.product_ids})
