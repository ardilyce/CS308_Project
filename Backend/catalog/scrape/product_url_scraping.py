import requests
from bs4 import BeautifulSoup
import json

BASE_URL = "https://www.mediamarkt.com.tr/tr/category/kisisel-bakim-465820.html?sort=salescount+desc"
MAX_PRODUCTS = 50
PRODUCT = "self_care"
def scrape_page(page):
    url = f"{BASE_URL}?sort=salescount+desc&page={page}"
    print("Scraping:", url)

    headers = {"User-Agent": "Mozilla/5.0"}
    r = requests.get(url, headers=headers)
    soup = BeautifulSoup(r.text, "html.parser")

    product_urls = []

    for a in soup.select('a[data-test="mms-router-link-product-list-item-link"]'):
        href = a.get("href")
        if href and href.startswith("/"):
            full_url = "https://www.mediamarkt.com.tr" + href
            product_urls.append(full_url)

    return product_urls


def scrape_all():
    all_products = []
    page = 1

    while len(all_products) < MAX_PRODUCTS:
        urls = scrape_page(page)

        if not urls:
            print("No more products. Stopping.")
            break

        all_products.extend(urls)
        page += 1

    all_products = all_products[:MAX_PRODUCTS]

    with open(f"{PRODUCT}_url.json", "w", encoding="utf-8") as f:
        json.dump(all_products, f, indent=4, ensure_ascii=False)

    print("\n✔ url.json başarıyla oluşturuldu!")
    print(f"Toplam {len(all_products)} adet ürün URL'si")


if __name__ == "__main__":
    scrape_all()
