from django.db import migrations, models


def backfill_delivery_status(apps, schema_editor):
    Delivery = apps.get_model("orders", "Delivery")
    for delivery in Delivery.objects.select_related("order").all():
        if getattr(delivery, "is_completed", False):
            delivery.status = "DELIVERED"
        elif getattr(delivery.order, "status", "") == "SHIPPED":
            delivery.status = "SHIPPED"
        else:
            delivery.status = "PROCESSING"
        delivery.save(update_fields=["status"])


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0007_refundrequest_manager_note"),
    ]

    operations = [
        migrations.AddField(
            model_name="delivery",
            name="status",
            field=models.CharField(
                choices=[
                    ("PROCESSING", "Processing"),
                    ("SHIPPED", "Shipped"),
                    ("DELIVERED", "Delivered"),
                ],
                default="PROCESSING",
                max_length=20,
            ),
        ),
        migrations.RunPython(backfill_delivery_status, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="delivery",
            name="is_completed",
        ),
    ]
