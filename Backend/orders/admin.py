from django.contrib import admin
from .models import Order, OrderItem, Invoice, Delivery


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "customer", "status", "total_amount", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("customer__username", "customer__email")
    inlines = [OrderItemInline]


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ("invoice_number", "order", "total_amount", "issue_date")
    list_filter = ("issue_date",)
    search_fields = ("invoice_number",)


@admin.register(Delivery)
class DeliveryAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "order",
        "customer",
        "product",
        "quantity",
        "total_price",
        "is_completed",
        "created_at",
        "delivered_at",
    )
    list_filter = ("is_completed", "created_at")
    search_fields = ("order__id", "customer__username", "product__name")


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ("order", "product", "quantity", "unit_price", "line_total")
    list_filter = ("product",)



