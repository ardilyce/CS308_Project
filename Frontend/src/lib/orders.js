// src/lib/orders.js
import { API_BASE } from "./api";

/**
 * Create a new order with payment processing
 * 
 * @param {Object} orderData - Order data
 * @param {Array} orderData.items - Array of { product_id, quantity }
 * @param {string} orderData.delivery_address - Delivery address
 * @param {Object} orderData.payment - Payment info
 * @param {string} orderData.payment.card_number - Card number (formatted: "1234 5678 9012 3456")
 * @param {string} orderData.payment.expiry - Expiry date ("MM/YY")
 * @param {string} orderData.payment.cvv - CVV code
 * @param {string} orderData.payment.cardholder_name - Cardholder name
 * 
 * Mock Payment Test Cards:
 * - Cards ending in '0000': Always DECLINED
 * - Cards ending in '1111': 50% chance of failure
 * - All other cards: APPROVED
 * 
 * @returns {Promise<{ok: boolean, data?: Object, error?: string}>}
 */
export async function createOrder(orderData) {
  const token = localStorage.getItem("accessToken");

  if (!token) {
    return { ok: false, error: "Please log in to place an order" };
  }

  try {
    const res = await fetch(`${API_BASE}/api/orders/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(orderData),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Handle payment-specific errors
      if (data.payment) {
        return { ok: false, error: data.payment, isPaymentError: true };
      }
      // Handle validation errors
      if (data.items || data.delivery_address) {
        const errors = [];
        if (data.items) errors.push(`Items: ${JSON.stringify(data.items)}`);
        if (data.delivery_address) errors.push(`Address: ${data.delivery_address}`);
        return { ok: false, error: errors.join(", ") };
      }
      return { ok: false, error: data.detail || data.error || `Error ${res.status}` };
    }

    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Get all orders for the current user
 * 
 * @returns {Promise<{ok: boolean, data?: Array, error?: string}>}
 */
export async function getMyOrders() {
  const token = localStorage.getItem("accessToken");

  if (!token) {
    return { ok: false, error: "Please log in to view orders" };
  }

  try {
    const res = await fetch(`${API_BASE}/api/orders/mine/`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { ok: false, error: data.detail || `Error ${res.status}` };
    }

    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Get a specific order by ID
 * 
 * @param {number|string} orderId - Order ID
 * @returns {Promise<{ok: boolean, data?: Object, error?: string}>}
 */
export async function getOrderById(orderId) {
  const token = localStorage.getItem("accessToken");

  if (!token) {
    return { ok: false, error: "Please log in to view order" };
  }

  try {
    const res = await fetch(`${API_BASE}/api/orders/mine/${orderId}/`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { ok: false, error: data.detail || `Error ${res.status}` };
    }

    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Cancel an order
 * 
 * @param {number|string} orderId - Order ID
 * @returns {Promise<{ok: boolean, data?: Object, error?: string}>}
 */
export async function cancelOrder(orderId) {
  const token = localStorage.getItem("accessToken");

  if (!token) {
    return { ok: false, error: "Please log in to cancel order" };
  }

  try {
    const res = await fetch(`${API_BASE}/api/orders/${orderId}/cancel/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { ok: false, error: data.error || data.detail || `Error ${res.status}` };
    }

    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Manually confirm payment for an order (for testing)
 * 
 * @param {number|string} orderId - Order ID
 * @returns {Promise<{ok: boolean, data?: Object, error?: string}>}
 */
export async function confirmPayment(orderId) {
  const token = localStorage.getItem("accessToken");

  if (!token) {
    return { ok: false, error: "Please log in" };
  }

  try {
    const res = await fetch(`${API_BASE}/api/orders/${orderId}/confirm-payment/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { ok: false, error: data.error || data.detail || `Error ${res.status}` };
    }

    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

