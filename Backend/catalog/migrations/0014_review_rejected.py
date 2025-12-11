from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0013_review_flag"),
    ]

    operations = [
        migrations.AddField(
            model_name="review",
            name="rejected",
            field=models.BooleanField(default=False),
        ),
    ]
