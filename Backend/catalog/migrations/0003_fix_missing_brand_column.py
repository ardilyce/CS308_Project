from django.db import migrations


def ensure_brand_column(apps, schema_editor):
    connection = schema_editor.connection
    table_name = "catalog_product"

    with connection.cursor() as cursor:
        description = connection.introspection.get_table_description(
            cursor, table_name
        )
        existing_columns = {col.name for col in description}

        if "brand" in existing_columns:
            return

        cursor.execute(
            f'ALTER TABLE "{table_name}" ADD COLUMN "brand" VARCHAR(200) DEFAULT %s;',
            [""],
        )
        cursor.execute(
            f'UPDATE "{table_name}" SET "brand" = %s WHERE "brand" IS NULL;', [""]
        )
        if connection.vendor == "postgresql":
            cursor.execute(
                f'ALTER TABLE "{table_name}" ALTER COLUMN "brand" SET NOT NULL;'
            )
            cursor.execute(
                f'ALTER TABLE "{table_name}" ALTER COLUMN "brand" DROP DEFAULT;'
            )


def noop(*args, **kwargs):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0002_product_image_url"),
    ]

    operations = [
        migrations.RunPython(ensure_brand_column, noop),
    ]
