from rest_framework import generics, filters
from .models import Category, ScrapedProduct
from .serializers import CategorySerializer, ScrapedProductSerializer


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

class ProductDetail(generics.RetrieveAPIView):
    queryset = ScrapedProduct.objects.all()
    serializer_class = ScrapedProductSerializer
