// src/lib/wishlist.js
import { API_BASE } from "./api";

function getToken() {
  return localStorage.getItem("accessToken");
}

export async function fetchWishlistProductIds() {
  const token = getToken();
  if (!token) return { ok: false, requiresAuth: true, productIds: [] };

  try {
    const res = await fetch(`${API_BASE}/api/wishlist/`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        ok: false,
        requiresAuth: res.status === 401,
        productIds: [],
        error: data.error || data.detail || `Error ${res.status}`,
      };
    }

    return {
      ok: true,
      productIds: Array.isArray(data.product_ids) ? data.product_ids : [],
    };
  } catch (err) {
    return { ok: false, productIds: [], error: err.message };
  }
}

export async function toggleWishlistProduct(productId) {
  const token = getToken();
  if (!token) return { ok: false, requiresAuth: true, error: "Login required" };

  try {
    const res = await fetch(`${API_BASE}/api/wishlist/toggle/`, {
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
        requiresAuth: res.status === 401,
        error: data.error || data.detail || `Error ${res.status}`,
      };
    }

    return {
      ok: true,
      inWishlist: Boolean(data.in_wishlist),
      productIds: Array.isArray(data.product_ids) ? data.product_ids : [],
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
