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
      // Handle stock availability errors
      if (data.stock_error) {
        return { 
          ok: false, 
          error: data.stock_error, 
          isStockError: true,
          stockItems: data.items || []
        };
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
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return { ok: false, error: errorData.detail || `Error ${res.status}` };
    }

    const data = await res.json();
    
    // Handle both paginated response and direct array response
    // DRF pagination returns: { count, next, previous, results: [...] }
    let orders;
    if (Array.isArray(data)) {
      orders = data;
    } else if (data && Array.isArray(data.results)) {
      orders = data.results;
    } else {
      console.error("Unexpected orders response format:", data);
      orders = [];
    }

    return { ok: true, data: orders };
  } catch (err) {
    console.error("Error fetching orders:", err);
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
 * Cancel a single order item
 * 
 * @param {number|string} orderId - Order ID
 * @param {number|string} orderItemId - OrderItem ID
 * @returns {Promise<{ok: boolean, data?: Object, error?: string}>}
 */
export async function cancelOrderItem(orderId, orderItemId) {
  const token = localStorage.getItem("accessToken");

  if (!token) {
    return { ok: false, error: "Please log in to cancel item" };
  }

  try {
    const res = await fetch(`${API_BASE}/api/orders/${orderId}/cancel-item/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ order_item_id: orderItemId }),
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

/**
 * Create a refund request for an order
 *
 * @param {number|string} orderId
 * @param {{items: Array<{order_item_id: number, quantity: number}>, reason?: string}} payload
 * @returns {Promise<{ok: boolean, data?: Object, error?: string, requiresAuth?: boolean}>}
 */
export async function requestRefund(orderId, payload) {
  const token = localStorage.getItem("accessToken");

  if (!token) {
    return { ok: false, error: "Please log in to request a refund", requiresAuth: true };
  }

  try {
    const res = await fetch(`${API_BASE}/api/orders/${orderId}/refunds/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: "Please log in to request a refund", requiresAuth: true };
      }
      const fieldError = data.detail || data.error || data.items || data.reason;
      const message =
        typeof fieldError === "string"
          ? fieldError
          : Array.isArray(fieldError)
            ? fieldError.join(", ")
            : fieldError
              ? JSON.stringify(fieldError)
              : `Error ${res.status}`;
      return { ok: false, error: message };
    }

    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Get refund requests for the current user
 *
 * @returns {Promise<{ok: boolean, data?: Array, error?: string, requiresAuth?: boolean}>}
 */
export async function getMyRefunds() {
  const token = localStorage.getItem("accessToken");

  if (!token) {
    return { ok: false, error: "Please log in to view refunds", requiresAuth: true };
  }

  try {
    const res = await fetch(`${API_BASE}/api/orders/refunds/mine/`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: "Please log in to view refunds", requiresAuth: true };
      }
      return { ok: false, error: data.detail || `Error ${res.status}` };
    }

    // Support possible pagination shape
    const refunds = Array.isArray(data) ? data : Array.isArray(data.results) ? data.results : [];
    return { ok: true, data: refunds };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Download invoice PDF for an order
 * 
 * @param {number|string} orderId - Order ID
 * @param {string} invoiceNumber - Invoice number (for filename)
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function downloadInvoicePDF(orderId, invoiceNumber) {
  const token = localStorage.getItem("accessToken");

  if (!token) {
    return { ok: false, error: "Please log in to download invoice" };
  }

  try {
    const res = await fetch(
      `${API_BASE}/api/orders/${orderId}/invoice-pdf/?download=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return { 
        ok: false, 
        error: errorData.error || errorData.detail || `Error ${res.status}` 
      };
    }

    // Get the PDF blob
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const filename = invoiceNumber 
      ? `invoice_${invoiceNumber}.pdf` 
      : `invoice_order_${orderId}.pdf`;

    // Create download link and trigger download
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    // Clean up the URL object after a short delay
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}