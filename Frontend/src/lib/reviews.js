// src/lib/reviews.js
import { API_BASE } from "./api";

/**
 * Submit a rating + comment for a product.
 *
 * @param {number|string} productId
 * @param {{ rating: number, comment?: string }} payload
 * @returns {Promise<{ok: boolean, data?: Object, error?: string, requiresAuth?: boolean}>}
 */
export async function submitReview(productId, payload) {
  const token = localStorage.getItem("accessToken");

  if (!token) {
    return { ok: false, error: "Please log in to leave a review", requiresAuth: true };
  }

  try {
    const res = await fetch(`${API_BASE}/api/products/${productId}/reviews/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { ok: false, error: data.detail || data.comment || data.rating || data.error || `Error ${res.status}` };
    }

    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
