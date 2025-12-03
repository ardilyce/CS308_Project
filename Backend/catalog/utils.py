# catalog/utils.py
import requests
from bs4 import BeautifulSoup
from functools import lru_cache

@lru_cache(maxsize=2048)
def extract_main_image(page_url: str) -> str | None:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/123.0.0.0 Safari/537.36"
        )
    }

    try:
        resp = requests.get(page_url, timeout=5, headers=headers)
        resp.raise_for_status()
    except Exception as e:
        # Debug için (istersen sonra silebilirsin)
        print("extract_main_image ERROR:", e)
        return None

    soup = BeautifulSoup(resp.text, "html.parser")

    # 1) OpenGraph image (çoğu sitede ana görsel burada)
    og_img = soup.find("meta", property="og:image")
    if og_img and og_img.get("content"):
        return og_img["content"]

    # 2) Yedek: sayfadaki ilk <img>
    img = soup.find("img")
    if img and img.get("src"):
        return img["src"]

    return None