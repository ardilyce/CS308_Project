from django.db.models import Avg, Count, Q
from rest_framework import filters, generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import Category, Review, ScrapedProduct, Wishlist
from .serializers import (
    CategorySerializer,
    ProductDetailSerializer,
    ReviewSerializer,
    ReviewFlagSerializer,
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
        avg_rating=Avg("reviews__rating", filter=Q(reviews__flag=True)),
        review_count=Count("reviews", filter=Q(reviews__flag=True)),
    )
    serializer_class = ProductDetailSerializer


# REVIEW LIST + CREATE
class ProductReviewListCreateView(generics.ListCreateAPIView):
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        product_id = self.kwargs["product_id"]
        base_qs = Review.objects.filter(product_id=product_id)
        if self.request.user.is_authenticated and self.request.user.is_staff:
            return base_qs
        return base_qs.filter(flag=True)

    def perform_create(self, serializer):
        product_id = self.kwargs["product_id"]
        # Comments require approval; rating-only reviews are auto-approved.
        comment = (serializer.validated_data.get("comment") or "").strip()
        should_auto_approve = comment == ""
        serializer.save(
            product_id=product_id,
            user=self.request.user,
            flag=should_auto_approve,
            comment=comment if comment is not None else "",
        )


class ReviewFlagUpdateView(generics.RetrieveUpdateDestroyAPIView):
    """
    PATCH /api/reviews/<id>/flag/ with {"flag": true|false}
    DELETE /api/reviews/<id>/flag/ to remove a review entirely (e.g. reject)
    Product managers (staff) only.
    """

    queryset = Review.objects.all()
    serializer_class = ReviewFlagSerializer
    permission_classes = [permissions.IsAdminUser]


class ReviewAdminListView(generics.ListAPIView):
    """
    GET /api/reviews/?status=pending|approved|all
    Visible only to staff/managers to review and approve comments.
    """

    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAdminUser]
    pagination_class = None  # simple list for manager UI

    def get_queryset(self):
        status_filter = (self.request.query_params.get("status") or "").lower()
        qs = Review.objects.all().select_related("product", "user").order_by(
            "-created_at"
        )
        if status_filter == "pending":
            return qs.filter(flag=False)
        if status_filter == "approved":
            return qs.filter(flag=True)
        return qs


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
