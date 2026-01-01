from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0018_scrapedproduct_cloudinary_image_url"),
    ]

    operations = [
        migrations.AddField(
            model_name="scrapedproduct",
            name="discount_rate",
            field=models.IntegerField(default=0),
        ),
    ]
