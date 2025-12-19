from django.urls import path

from .views import (
    DeliveryListView,
    InvoiceListView,
    MyOrderDetailView,
    MyOrdersListView,
    OrderCreateView,
    cancel_order,
    confirm_payment,
    update_delivery_status,
)

urlpatterns = [
    path("", OrderCreateView.as_view(), name="order-create"),  # POST /api/orders/
    path(
        "mine/", MyOrdersListView.as_view(), name="order-list"
    ),  # GET  /api/orders/mine/
    path(
        "mine/<int:pk>/", MyOrderDetailView.as_view(), name="order-detail"
    ),  # GET  /api/orders/mine/1/
    path(
        "<int:order_id>/confirm-payment/", confirm_payment, name="order-confirm-payment"
    ),  # POST
    path("<int:order_id>/cancel/", cancel_order, name="order-cancel"),  # POST
    path(
        "deliveries/", DeliveryListView.as_view(), name="delivery-list"
    ),  # GET deliveries for managers
    path(
        "deliveries/<int:pk>/status/", update_delivery_status, name="delivery-status"
    ),  # PATCH status
    path("invoices/", InvoiceListView.as_view()),
]
