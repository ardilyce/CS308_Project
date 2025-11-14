import os
import sys
import json
import django
import psycopg


# ----------------------------------------------------
# 1) Django projesinin kök dizinini PYTHONPATH'e ekle
#    (scrape → catalog → Backend → burası root)
# ----------------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(BASE_DIR)


# ----------------------------------------------------
# 2) Django settings import path
#    settings.py = /Backend/backend/settings.py
#    O yüzden settings yolu = backend.settings
# ----------------------------------------------------
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")


# ----------------------------------------------------
# 3) Django başlat
# ----------------------------------------------------
django.setup()


from django.conf import settings


# ----------------------------------------------------
# 4) Postgres bağlantısı (Django DATABASES ile)
# ----------------------------------------------------
dsn = settings.DATABASES["default"]["OPTIONS"]["dsn"]
conn = psycopg.connect(dsn)
cur = conn.cursor()

print("✔ DB bağlantısı kuruldu.")


# ----------------------------------------------------
# 5) Tabloyu oluştur (yoksa)
# ----------------------------------------------------
create_table_sql = """
CREATE TABLE IF NOT EXISTS scraped_product (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    model VARCHAR(255),
    serialnumber VARCHAR(255),
    description TEXT,
    stock INTEGER,
    price INTEGER,
    warranty VARCHAR(50),
    distributer VARCHAR(255),
    url TEXT,
    category VARCHAR(50) DEFAULT 'Phone'
);
"""
cur.execute(create_table_sql)
conn.commit()

print("✔ Table 'scraped_product' hazır!")


# ----------------------------------------------------
# 6) URL alanına unique constraint ekle (dup engelle)
# ----------------------------------------------------
cur.execute("""
ALTER TABLE scraped_product 
ADD CONSTRAINT IF NOT EXISTS unique_url UNIQUE (url);
""")
conn.commit()

print("✔ 'url' unique constraint aktif!")


# ----------------------------------------------------
# 7) JSON dosyasını oku
# ----------------------------------------------------
json_path = os.path.join(os.path.dirname(__file__), "products.json")

with open(json_path, "r", encoding="utf-8") as f:
    products = json.load(f)

print(f"✔ {len(products)} ürün JSON'dan okundu.")


# ----------------------------------------------------
# 8) Ürünleri DB'ye ekle
# ----------------------------------------------------
insert_sql = """
INSERT INTO scraped_product
(name, model, serialnumber, description, stock, price, warranty, distributer, url, category)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'Phone')
ON CONFLICT (url) DO NOTHING;
"""

count = 0
for p in products:
    cur.execute(insert_sql, (
        p.get("name"),
        p.get("model"),
        p.get("serialnumber"),
        p.get("description"),
        p.get("stock"),
        p.get("price"),
        p.get("warranty"),
        p.get("distributer"),
        p.get("url"),
    ))
    count += 1

conn.commit()
cur.close()
conn.close()

print(f"✔ {count} ürün başarıyla yüklendi!")
