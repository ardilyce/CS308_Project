// src/lib/cart.js
import { API_BASE } from "./api";

export const GUEST_CART_KEY = "guest_cart";

// ---------------------------
// HELPER FUNCTIONS
// ---------------------------
function readGuestCart() {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeGuestCart(items) {
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
}

// ---------------------------
// ADD TO CART (MAIN FUNCTION)
// ---------------------------
export async function addToCart(productId) {
  const token = localStorage.getItem("accessToken");

  // 🔸 1) GUEST MODE — localStorage
  if (!token) {
    let guest = readGuestCart();

    let found = false;
    guest = guest.map((item) => {
      if (item.id === productId) {
        found = true;
        return { ...item, qty: item.qty + 1 };
      }
      return item;
    });

    if (!found) {
      guest.push({ id: productId, qty: 1 });
    }

    writeGuestCart(guest);

    return { ok: true, guest: true, items: guest };
  }

  // 🔹 2) LOGIN MODE — backend POST
  try {
    const res = await fetch(`${API_BASE}/api/cart/add/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ product_id: productId }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        ok: false,
        guest: false,
        error:
          data.error ||
          data.detail ||
          `Backend cart error (status ${res.status})`,
      };
    }

    return { ok: true, guest: false, data };
  } catch (err) {
    return { ok: false, guest: false, error: err.message || "network error" };
  }
}
