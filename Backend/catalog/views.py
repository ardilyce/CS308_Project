from django.shortcuts import render
from rest_framework import generics, filters
from .models import Category,Product
from .serializers import CategorySerializer,ProductSerializer


class CategoryList(generics.ListAPIView):
    queryset = Category.objects.all().order_by("id")
    serializer_class = CategorySerializer

class CategoryDetail(generics.RetrieveAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    lookup_field = "slug"

class ProductList(generics.ListAPIView):
    queryset = Product.objects.select_related("category").all().order_by("id")
    serializer_class = ProductSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "brand"]

    def get_queryset(self):
        qs = super().get_queryset()
        cat = self.request.query_params.get("category")
        brand = self.request.query_params.get("brand")
        if cat:
            qs = qs.filter(category__slug=cat)
        if brand:
            qs = qs.filter(brand__iexact=brand)
        return qs

class ProductDetail(generics.RetrieveAPIView):
    queryset = Product.objects.select_related("category")
    serializer_class = ProductSerializer