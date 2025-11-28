from django.urls import path
from .views import (
    OrderCreateView,
    MyOrdersListView,
    MyOrderDetailView,
    confirm_payment,
    cancel_order,
)

urlpatterns = [
    path("", OrderCreateView.as_view(), name="order-create"),                    # POST /api/orders/
    path("mine/", MyOrdersListView.as_view(), name="order-list"),               # GET  /api/orders/mine/
    path("mine/<int:pk>/", MyOrderDetailView.as_view(), name="order-detail"),   # GET  /api/orders/mine/1/
    path("<int:order_id>/confirm-payment/", confirm_payment, name="order-confirm-payment"),  # POST
    path("<int:order_id>/cancel/", cancel_order, name="order-cancel"),          # POST
]

