from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0012_delete_wishlistitem"),
    ]

    operations = [
        migrations.AddField(
            model_name="review",
            name="flag",
            field=models.BooleanField(default=False),
        ),
    ]
