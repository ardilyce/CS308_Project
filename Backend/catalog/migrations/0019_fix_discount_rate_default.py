from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0018_scrapedproduct_cloudinary_image_url"),
    ]

    operations = [
        migrations.RunSQL(
            """
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'catalog_scrapedproduct'
                      AND column_name = 'discount_rate'
                ) THEN
                    UPDATE catalog_scrapedproduct
                    SET discount_rate = 0
                    WHERE discount_rate IS NULL;

                    ALTER TABLE catalog_scrapedproduct
                    ALTER COLUMN discount_rate SET DEFAULT 0;

                    ALTER TABLE catalog_scrapedproduct
                    ALTER COLUMN discount_rate SET NOT NULL;
                ELSE
                    ALTER TABLE catalog_scrapedproduct
                    ADD COLUMN discount_rate integer NOT NULL DEFAULT 0;
                END IF;
            END $$;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
