import os
import threading

from django.conf import settings
from django.core.mail import EmailMessage
from django.db.models import Avg, Count, Q
from rest_framework import filters, generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .models import Category, Review, ScrapedProduct, Wishlist
from .serializers import (
    CategorySerializer,
    ProductDetailSerializer,
    ReviewFlagSerializer,
    ReviewSerializer,
    ScrapedProductSerializer,
    WishlistSerializer,
)


class FlexiblePageNumberPagination(PageNumberPagination):
    """Pagination class that allows frontend to control page size via query param."""

    page_size = 20  # default
    page_size_query_param = "page_size"
    max_page_size = 100


class CategoryList(generics.ListCreateAPIView):
    queryset = Category.objects.all().order_by("id")
    serializer_class = CategorySerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [permissions.IsAdminUser()]
        return [permissions.AllowAny()]


class CategoryDetail(generics.RetrieveDestroyAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    lookup_field = "slug"

    def get_permissions(self):
        if self.request.method == "DELETE":
            return [permissions.IsAdminUser()]
        return [permissions.AllowAny()]


class ProductList(generics.ListCreateAPIView):
    serializer_class = ScrapedProductSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "model", "serialnumber", "distributer", "category"]
    pagination_class = FlexiblePageNumberPagination

    def get_permissions(self):
        if self.request.method == "POST":
            return [permissions.IsAdminUser()]
        return [permissions.AllowAny()]

    def get_queryset(self):
        include_inactive = self.request.query_params.get("include_inactive") == "true"
        if include_inactive:
            qs = ScrapedProduct.objects.all()
        else:
            qs = ScrapedProduct.objects.filter(is_active=True)

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

    def perform_create(self, serializer):
        # Access image from validated_data (it's validated by ImageField)
        image = serializer.validated_data.get("image")

        # If no URL is provided, generate a dummy one (unique)
        url = serializer.validated_data.get("url")
        if not url:
            name_slug = (
                (serializer.validated_data.get("name") or "product")
                .lower()
                .replace(" ", "-")
            )
            import uuid

            url = (
                f"https://shop.example.com/products/{name_slug}-{uuid.uuid4().hex[:8]}"
            )

        # This will call ScrapedProductSerializer.create() which pops 'image'
        product = serializer.save(url=url)

        if image:
            # Determine extension
            ext = os.path.splitext(image.name)[1].lower()
            if ext not in [".png", ".webp", ".jpg", ".jpeg"]:
                ext = ".png"  # fallback

            # Save to media/products/{id}.{ext}
            products_dir = os.path.join(settings.MEDIA_ROOT, "products")
            os.makedirs(products_dir, exist_ok=True)

            # Use png or webp as per the model's image_url property logic
            save_ext = "png" if ext in [".png", ".jpg", ".jpeg"] else "webp"
            image_path = os.path.join(products_dir, f"{product.id}.{save_ext}")

            with open(image_path, "wb+") as destination:
                for chunk in image.chunks():
                    destination.write(chunk)


# ÜRÜN DETAYI + ORTALAMA RATING
class ProductDetail(generics.RetrieveAPIView):
    queryset = ScrapedProduct.objects.filter(is_active=True).annotate(
        # Ratings should remain visible even if comments await approval
        avg_rating=Avg("reviews__rating"),
        review_count=Count("reviews"),
    )
    serializer_class = ProductDetailSerializer
    permission_classes = [permissions.AllowAny]

    def delete(self, request, *args, **kwargs):
        product = self.get_object()
        product.is_active = False
        product.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)


# REVIEW LIST + CREATE
class ProductReviewListCreateView(generics.ListCreateAPIView):
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        product_id = self.kwargs["product_id"]
        base_qs = Review.objects.filter(product_id=product_id)
        # Ratings should remain visible even if comment is pending;
        # comment text is hidden at serialization time when not approved.
        return base_qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        product_id = self.kwargs["product_id"]
        comment = (serializer.validated_data.get("comment") or "").strip()
        rating = serializer.validated_data.get("rating")
        should_auto_approve = comment == ""

        existing = Review.objects.filter(
            product_id=product_id, user=request.user
        ).first()

        # Allow adding a first-time comment later if initial review was rating-only
        if existing:
            if not existing.rejected and existing.comment.strip() == "" and comment:
                existing.rating = rating
                existing.comment = comment
                existing.flag = should_auto_approve
                existing.save(update_fields=["rating", "comment", "flag"])
                serializer.instance = existing
                headers = self.get_success_headers(serializer.data)
                return Response(
                    serializer.data, status=status.HTTP_200_OK, headers=headers
                )

            return Response(
                {"error": "You have already reviewed this product."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Fresh review
        serializer.save(
            product_id=product_id,
            user=request.user,
            flag=should_auto_approve,
            comment=comment if comment is not None else "",
        )
        headers = self.get_success_headers(serializer.data)
        return Response(
            serializer.data, status=status.HTTP_201_CREATED, headers=headers
        )


class ReviewFlagUpdateView(generics.RetrieveUpdateDestroyAPIView):
    """
    PATCH /api/reviews/<id>/flag/ with {"flag": true|false}
    DELETE /api/reviews/<id>/flag/ to reject (sets flag=False without deleting)
    Product managers (staff) only.
    """

    queryset = Review.objects.all()
    serializer_class = ReviewFlagSerializer
    permission_classes = [permissions.IsAdminUser]

    def destroy(self, request, *args, **kwargs):
        # Reject by unapproving instead of deleting, so rating stays in aggregates.
        instance = self.get_object()
        instance.flag = False
        instance.rejected = True
        instance.save(update_fields=["flag", "rejected"])
        serializer = self.get_serializer(instance)
        return Response(serializer.data, status=status.HTTP_200_OK)


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
        qs = (
            Review.objects.all()
            .select_related("product", "user")
            .order_by("-created_at")
        )
        if status_filter == "pending":
            # Show only non-rejected, comment-bearing pending items
            return qs.filter(flag=False, rejected=False).exclude(comment="")
        if status_filter == "approved":
            return qs.filter(flag=True)
        return qs.filter(rejected=False)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        # Allow managers to see comment text even when not approved in admin UI
        ctx["show_unapproved_comment"] = True
        return ctx


# WISHLIST LIST
class WishlistView(generics.RetrieveUpdateAPIView):
    """
    GET  /api/wishlist/  → product_ids listesini getir (sadece aktif ürünler)
    PUT  /api/wishlist/  → product_ids listesini güncelle
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = WishlistSerializer

    def get_object(self):
        wishlist, _ = Wishlist.objects.get_or_create(user=self.request.user)

        # SADECE aktif ürünleri tut
        active_ids = list(
            ScrapedProduct.objects.filter(
                id__in=wishlist.product_ids, is_active=True
            ).values_list("id", flat=True)
        )

        # Eğer temizlik yaptıysak DB'yi güncelle
        if set(active_ids) != set(wishlist.product_ids):
            wishlist.product_ids = active_ids
            wishlist.save(update_fields=["product_ids"])

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


@api_view(["DELETE"])
@permission_classes([permissions.IsAuthenticated])
def delete_product(request, pk):
    product = ScrapedProduct.objects.filter(pk=pk).first()
    if not product:
        return Response(
            {"detail": "Product not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    product.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["PATCH"])
@permission_classes([permissions.IsAuthenticated])
def update_product_stocks(request):
    stocks = request.data.get("stocks", [])

    if not isinstance(stocks, list):
        return Response({"error": "stocks must be a list"}, status=400)

    updated_ids = []

    for item in stocks:
        pid = item.get("id")
        stock = item.get("stock")

        if pid is None or stock is None:
            continue

        try:
            stock = int(stock)
        except (ValueError, TypeError):
            continue

        # sadece aktif ürünler
        ScrapedProduct.objects.filter(id=pid, is_active=True).update(stock=stock)

        updated_ids.append(pid)

    return Response({"updated_ids": updated_ids}, status=status.HTTP_200_OK)


@api_view(["PATCH"])
@permission_classes([permissions.IsAuthenticated])
def apply_discount(request):
    product_ids = request.data.get("product_ids", [])
    discount_percentage = request.data.get("discount_percentage")

    if not product_ids or discount_percentage is None:
        return Response(
            {"error": "product_ids and discount_percentage are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        discount_percentage = int(discount_percentage)
    except (ValueError, TypeError):
        return Response(
            {"error": "discount_percentage must be an integer"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if discount_percentage < 0 or discount_percentage > 100:
        return Response(
            {"error": "discount_percentage must be between 0 and 100"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # MAIL İÇİN PRODUCT'LARI ÖNCE AL
    products = list(
        ScrapedProduct.objects.filter(
            id__in=product_ids,
            is_active=True,
        )
    )

    # DB UPDATE
    updated = ScrapedProduct.objects.filter(
        id__in=product_ids,
        is_active=True,
    ).update(
        discount=True,
        discount_percentage=discount_percentage,
    )

    # ASYNC MAIL
    threading.Thread(
        target=send_wishlist_discount_emails,
        args=(products, discount_percentage),
        daemon=True,
    ).start()

    return Response(
        {
            "updated_count": updated,
            "discount_percentage": discount_percentage,
            "email_status": "sending_in_background",
        },
        status=status.HTTP_200_OK,
    )


def send_wishlist_discount_emails(products, discount_percentage):
    product_ids = [p.id for p in products]

    wishlists = Wishlist.objects.filter(
        Q(product_ids__overlap=product_ids)
    ).select_related("user")

    for wishlist in wishlists:
        user = wishlist.user
        if not user.email:
            continue

        for product in products:
            if product.id not in wishlist.product_ids:
                continue

            subject = "Item from your wishlist is on discount!"
            body = f"""
Hi {user.get_full_name() or user.username},

Good news 🎉

An item in your wishlist ({product.name}) is now on {discount_percentage}% discount!

Check it out before the offer ends.

Best regards,
CS308 E-Commerce Team
            """.strip()

            email = EmailMessage(
                subject=subject,
                body=body,
                from_email=None,
                to=[user.email],
            )

            email.send(fail_silently=False)


@api_view(["PATCH"])
@permission_classes([permissions.IsAuthenticated])
def reset_discounts(request):
    product_ids = request.data.get("product_ids", [])

    if not product_ids:
        return Response(
            {"error": "product_ids are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    updated = ScrapedProduct.objects.filter(
        id__in=product_ids,
        is_active=True,
    ).update(
        discount=False,
        discount_percentage=None,
    )

    return Response(
        {
            "updated_count": updated,
            "message": "Discounts reset successfully",
        },
        status=status.HTTP_200_OK,
    )
