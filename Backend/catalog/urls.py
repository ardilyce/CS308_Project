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
    # --- Wishlist ---
    path("wishlist/", views.WishlistView.as_view(), name="wishlist"),
    path("wishlist/toggle/", views.wishlist_toggle, name="wishlist-toggle"),
]
