from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0006_alter_scrapedproduct_table"),
    ]

    operations = [
        migrations.DeleteModel(
            name="Product",
        ),
    ]
