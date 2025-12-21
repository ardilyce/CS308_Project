from django.urls import path

from . import views

urlpatterns = [
    path("categories/", views.CategoryList.as_view()),
    path("categories/<slug:slug>/", views.CategoryDetail.as_view()),
    path("products/", views.ProductList.as_view()),
    path("products/<int:pk>/", views.ProductDetail.as_view()),
    path(
        "products/<int:product_id>/reviews/",
        views.ProductReviewListCreateView.as_view(),
        name="product-reviews",
    ),
    path("reviews/", views.ReviewAdminListView.as_view(), name="review-list"),
    path(
        "reviews/<int:pk>/flag/",
        views.ReviewFlagUpdateView.as_view(),
        name="review-flag",
    ),
    # --- Wishlist ---
    path("wishlist/", views.WishlistView.as_view(), name="wishlist"),
    path("wishlist/toggle/", views.wishlist_toggle, name="wishlist-toggle"),
    path("products/stock/", views.update_product_stocks),
    path("products/apply-discount/", views.apply_discount),
    path("products/reset-discounts/", views.reset_discounts),
]
