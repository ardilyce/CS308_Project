import json
import random
import requests
from bs4 import BeautifulSoup

WARRANTY = "2 yıl"
MIN_STOCK = 5
MAX_STOCK = 50

headers = {"User-Agent": "Mozilla/5.0"}

def extract_digits(text):
    if not text:
        return None
    digits = "".join([ch for ch in text if ch.isdigit()])
    return digits if digits else None


def clean_price(text):
    if not text:
        return None
    text = text.replace("₺", "").replace(".", "").replace(",", "").strip()
    if text.isdigit():
        return int(text)
    return None


def extract_text(element):
    if element:
        return " ".join(element.stripped_strings)
    return None


def scrape_product(url, pid):
    print(f"[{pid}] scraping:", url)

    r = requests.get(url, headers=headers)
    soup = BeautifulSoup(r.text, "html.parser")

    name = extract_text(soup.select_one('h1.sc-94eb08bc-0.dPxwlD'))
    model = extract_text(
    soup.select_one('li.sc-6b54083e-2.btcPsL a[data-test="mms-anchor-link"] span.sc-94eb08bc-0.hmVqRh.sc-a0079270-0.erHzFH')
)

    serial_raw = extract_text(soup.select_one('p[data-test="pdp-article-number"]'))
    serial = extract_digits(serial_raw)


    desc_block = soup.select_one('div[data-test="pdp-description-pim-fallback"]')
    description = extract_text(desc_block)

    price_raw = extract_text(soup.select_one('span[data-test="branded-price-whole-value"]'))
    price = clean_price(price_raw)

    # ---- DISTRIBUTER ----
    dist_el = soup.select_one(
        'div[data-test="mms-select-details-header"] a[data-test="mms-router-link"] span.sc-94eb08bc-0.gUcyZC.sc-a0079270-0.erHzFH'
    )
    distributer = extract_text(dist_el) if dist_el else None


    stock = random.randint(MIN_STOCK, MAX_STOCK)

    return {
        "id": pid,
        "name": name,
        "model": model,
        "serialnumber": serial,
        "description": description,
        "stock": stock,
        "price": price,
        "warranty": WARRANTY,
        "distributer": distributer,
        "url": url
    }


def scrape_all_products():
    with open("url.json", "r", encoding="utf-8") as f:
        urls = json.load(f)

    products = []

    for i, url in enumerate(urls, start=1):
        try:
            product = scrape_product(url, i)
            products.append(product)
        except Exception as e:
            print("Error on", url, "->", e)

    with open("products.json", "w", encoding="utf-8") as f:
        json.dump(products, f, indent=4, ensure_ascii=False)

    print("\n✔ products.json başarıyla oluşturuldu!")
    print(f"Toplam ürün: {len(products)}")


if __name__ == "__main__":
    scrape_all_products()
