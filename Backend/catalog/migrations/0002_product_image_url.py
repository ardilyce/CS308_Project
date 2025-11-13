from django.db import migrations, models


ADD_COLUMN_SQL = """
ALTER TABLE catalog_product
ADD COLUMN IF NOT EXISTS image_url VARCHAR(200);
"""

SET_DEFAULT_SQL = "ALTER TABLE catalog_product ALTER COLUMN image_url SET DEFAULT '';"
DROP_DEFAULT_SQL = "ALTER TABLE catalog_product ALTER COLUMN image_url DROP DEFAULT;"
FILL_EMPTY_SQL = "UPDATE catalog_product SET image_url = '' WHERE image_url IS NULL;"
SET_NOT_NULL_SQL = "ALTER TABLE catalog_product ALTER COLUMN image_url SET NOT NULL;"
DROP_NOT_NULL_SQL = "ALTER TABLE catalog_product ALTER COLUMN image_url DROP NOT NULL;"


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0001_initial'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=ADD_COLUMN_SQL,
                    reverse_sql="ALTER TABLE catalog_product DROP COLUMN IF EXISTS image_url;",
                ),
                migrations.RunSQL(sql=SET_DEFAULT_SQL, reverse_sql=DROP_DEFAULT_SQL),
                migrations.RunSQL(sql=FILL_EMPTY_SQL, reverse_sql=migrations.RunSQL.noop),
                migrations.RunSQL(sql=SET_NOT_NULL_SQL, reverse_sql=DROP_NOT_NULL_SQL),
                migrations.RunSQL(sql=DROP_DEFAULT_SQL, reverse_sql=SET_DEFAULT_SQL),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='product',
                    name='image_url',
                    field=models.URLField(blank=True),
                ),
            ],
        ),
    ]
