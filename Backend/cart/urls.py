from django.urls import path

from .views import add_to_cart, get_cart, remove_from_cart

urlpatterns = [
    path("", get_cart),
    path("add/", add_to_cart),
    path("remove/", remove_from_cart),
]
