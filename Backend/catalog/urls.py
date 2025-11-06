from django.urls import path
from . import views

urlpatterns = [
    path("categories/", views.CategoryList.as_view()),
    path("categories/<slug:slug>/", views.CategoryDetail.as_view()),
    path("products/", views.ProductList.as_view()),
    path("products/<int:pk>/", views.ProductDetail.as_view()),
]
