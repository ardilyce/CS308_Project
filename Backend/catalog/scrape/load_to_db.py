import json
import os
import sys

import django
import psycopg

# ---------------------------------------------
# Django path fix (BASE_DIR)
# ---------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(BASE_DIR)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from django.conf import settings

PRODUCT = "self_care"

print("✔ Django setup OK")

# ---------------------------------------------
# DB connect
# ---------------------------------------------
db = settings.DATABASES["default"]

conn = psycopg.connect(
    dbname=db["NAME"],
    user=db["USER"],
    password=db["PASSWORD"],
    host=db["HOST"],
    port=db.get("PORT", 5432),
)
cur = conn.cursor()

print("✔ PostgreSQL bağlantısı OK")

# ---------------------------------------------
# JSON yükle
# ---------------------------------------------
with open(f"{PRODUCT}_products.json", "r", encoding="utf-8") as f:
    products = json.load(f)

print(f"✔ JSON yüklendi. Ürün sayısı: {len(products)}")

# ---------------------------------------------
# Insert SQL → id verilmez, url unique
# ---------------------------------------------
insert_sql = """
INSERT INTO catalog_scrapedproduct
(name, model, serialnumber, description, stock, price, warranty, distributer, url, category)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (url) DO NOTHING;
"""

count = 0

for p in products:
    cur.execute(
        insert_sql,
        (
            p["name"],
            p["model"],
            p["serialnumber"],
            p["description"],
            p["stock"],
            p["price"],
            p["warranty"],
            p["distributer"],
            p["url"],
            p.get("category", PRODUCT),
        ),
    )
    count += 1

conn.commit()
cur.close()
conn.close()

print(f"🎉 {count} ürün başarıyla 'catalog_scrapedproduct' tablosuna yüklendi!")
