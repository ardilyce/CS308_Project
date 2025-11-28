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
export async function addToCart(productId, stock) {
  const token = localStorage.getItem("accessToken");

  // 1) STOCK CHECK (client-side)
  if (stock <= 0) {
    return { ok: false, error: "Out of stock" };
  }

  // ───────────────────────────────
  //  A) GUEST USER – localStorage
  // ───────────────────────────────
  if (!token) {
    let guest = readGuestCart();
    let existing = guest.find((item) => item.id === productId);

    // sepette varsa ve bir artırınca stok aşılırsa
    if (existing && existing.qty + 1 > stock) {
      return { ok: false, error: "Not enough stock" };
    }

    // sepette yoksa ama stock sıfırsa
    if (!existing && stock <= 0) {
      return { ok: false, error: "Out of stock" };
    }

    // normal guest ekleme
    if (existing) {
      existing.qty += 1;
    } else {
      guest.push({ id: productId, qty: 1 });
    }

    writeGuestCart(guest);

    return { ok: true, guest: true, items: guest };
  }

  // ───────────────────────────────
  //  B) LOGGED-IN USER – backend
  // ───────────────────────────────
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
        error: data.error || data.detail || `Error ${res.status}`,
      };
    }

    return { ok: true, guest: false, data };
  } catch (err) {
    return { ok: false, guest: false, error: err.message };
  }
}

// ---------------------------
// MERGE GUEST CART (on login/signup)
// ---------------------------
/**
 * Merge guest cart with user's backend cart.
 * Validates product existence and stock on server side.
 * Returns an object with { success, warnings, error? } for feedback.
 * 
 * @param {string} token - JWT access token
 * @returns {Promise<{success: boolean, warnings: string[], error?: string}>}
 */
export async function mergeGuestCart(token) {
  const guest = readGuestCart();

  if (guest.length === 0) {
    return { success: true, warnings: [] };
  }

  try {
    const res = await fetch(`${API_BASE}/api/cart/merge/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ guest_items: guest }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("Cart merge failed:", data);
      return {
        success: false,
        warnings: [],
        error: data.error || data.detail || `Error ${res.status}`,
      };
    }

    // Clear guest cart after successful merge
    localStorage.removeItem(GUEST_CART_KEY);

    // Extract warnings if any (stock adjustments, removed items, etc.)
    const warnings = data.warnings || [];
    
    if (warnings.length > 0) {
      console.info("Cart merge warnings:", warnings);
    }

    return { success: true, warnings };
  } catch (err) {
    console.error("Failed to merge guest cart:", err);
    // Don't clear guest cart on failure - user can try again
    return { success: false, warnings: [], error: err.message };
  }
}