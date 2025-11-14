from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0007_delete_product"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="scrapedproduct",
            options={"ordering": ["-id"]},
        ),
        migrations.AddIndex(
            model_name="scrapedproduct",
            index=models.Index(
                fields=["category", "distributer"],
                name="catalog_scr_categor_83594b_idx",
            ),
        ),
    ]
