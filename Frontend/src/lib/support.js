import axios from "axios";
import { API_BASE } from "./api";

const API = API_BASE;

function getAuthHeaders() {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Create a new conversation
 */
export async function createConversation(guestName = "", guestEmail = "") {
  try {
    const headers = getAuthHeaders();
    let guestToken = localStorage.getItem("chat_guest_token");
    
    // Generate token if not exists
    if (!guestToken) {
      guestToken = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("chat_guest_token", guestToken);
    }
    
    const response = await axios.post(
      `${API}/api/support/conversations/`,
      {
        guest_name: guestName,
        guest_email: guestEmail,
        guest_token: guestToken,
      },
      { headers }
    );
    
    // Update stored token if server generated a new one
    if (response.data.guest_token) {
      localStorage.setItem("chat_guest_token", response.data.guest_token);
    }
    
    return { ok: true, data: response.data };
  } catch (error) {
    return {
      ok: false,
      error: error.response?.data?.detail || error.message,
    };
  }
}

/**
 * Get conversation details
 */
export async function getConversation(conversationId) {
  try {
    const headers = getAuthHeaders();
    const guestToken = localStorage.getItem("chat_guest_token") || "";
    
    const response = await axios.get(
      `${API}/api/support/conversations/${conversationId}/`,
      {
        headers: {
          ...headers,
          "X-GUEST-TOKEN": guestToken,
        },
      }
    );
    return { ok: true, data: response.data };
  } catch (error) {
    return {
      ok: false,
      error: error.response?.data?.detail || error.message,
    };
  }
}

/**
 * Get messages for a conversation
 */
export async function getMessages(conversationId) {
  try {
    const headers = getAuthHeaders();
    const guestToken = localStorage.getItem("chat_guest_token") || "";

    const response = await axios.get(
      `${API}/api/support/conversations/${conversationId}/messages/`,
      {
        headers: {
          ...headers,
          "X-GUEST-TOKEN": guestToken,
        },
      }
    );

    return { ok: true, data: response.data };
  } catch (error) {
    return {
      ok: false,
      error: error.response?.data?.detail || error.response?.data?.message || error.message,
    };
  }
}

/**
 * Upload a file attachment or send text message
 */
export async function uploadMessageAttachment(conversationId, file, text = "") {
  try {
    const headers = getAuthHeaders();
    const guestToken = localStorage.getItem("chat_guest_token") || "";
    
    const formData = new FormData();
    // Only append file if it exists
    if (file) {
      formData.append("attachment", file);
    }
    if (text) {
      formData.append("text", text);
    }

    const response = await axios.post(
      `${API}/api/support/conversations/${conversationId}/messages/`,
      formData,
      {
        headers: {
          ...headers,
          "X-GUEST-TOKEN": guestToken,
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return { ok: true, data: response.data };
  } catch (error) {
    return {
      ok: false,
      error: error.response?.data?.detail || error.message,
    };
  }
}

// ========== Agent Functions ==========

/**
 * Get queue of unclaimed conversations
 */
export async function getAgentQueue() {
  try {
    const headers = getAuthHeaders();
    const response = await axios.get(
      `${API}/api/support/agent/queue/`,
      { headers }
    );
    return { ok: true, data: response.data };
  } catch (error) {
    return {
      ok: false,
      error: error.response?.data?.detail || error.message,
    };
  }
}

/**
 * Get active conversations for current agent
 */
export async function getAgentActiveConversations() {
  try {
    const headers = getAuthHeaders();
    const response = await axios.get(
      `${API}/api/support/agent/conversations/active/`,
      { headers }
    );
    return { ok: true, data: response.data };
  } catch (error) {
    return {
      ok: false,
      error: error.response?.data?.detail || error.message,
    };
  }
}

/**
 * Claim a conversation
 */
export async function claimConversation(conversationId) {
  try {
    const headers = getAuthHeaders();
    const response = await axios.post(
      `${API}/api/support/agent/conversations/${conversationId}/claim/`,
      {},
      { headers }
    );
    return { ok: true, data: response.data };
  } catch (error) {
    return {
      ok: false,
      error: error.response?.data?.detail || error.message,
    };
  }
}

/**
 * Close a conversation
 */
export async function closeConversation(conversationId) {
  try {
    const headers = getAuthHeaders();
    const response = await axios.post(
      `${API}/api/support/agent/conversations/${conversationId}/close/`,
      {},
      { headers }
    );
    return { ok: true, data: response.data };
  } catch (error) {
    return {
      ok: false,
      error: error.response?.data?.detail || error.message,
    };
  }
}

/**
 * Get customer context (cart, orders, wishlist)
 */
export async function getCustomerContext(conversationId) {
  try {
    const headers = getAuthHeaders();
    const response = await axios.get(
      `${API}/api/support/conversations/${conversationId}/context/`,
      { headers }
    );
    return { ok: true, data: response.data };
  } catch (error) {
    return {
      ok: false,
      error: error.response?.data?.detail || error.message,
    };
  }
}

/**
 * Get order details for support agents (can view any customer's order)
 */
export async function getSupportAgentOrderDetail(orderId) {
  try {
    const headers = getAuthHeaders();
    const response = await axios.get(
      `${API}/api/support/agent/orders/${orderId}/`,
      { headers }
    );
    return { ok: true, data: response.data };
  } catch (error) {
    return {
      ok: false,
      error: error.response?.data?.detail || error.message,
    };
  }
}

/**
 * Get invoice HTML for support agents (can view any customer's invoice)
 */
export async function getSupportAgentInvoiceHtml(orderId) {
  try {
    const headers = getAuthHeaders();
    const response = await axios.get(
      `${API}/api/support/agent/orders/${orderId}/invoice/`,
      { headers }
    );
    return { ok: true, data: response.data };
  } catch (error) {
    return {
      ok: false,
      error: error.response?.data?.error || error.response?.data?.detail || error.message,
    };
  }
}

/**
 * Get download URL for a message attachment
 * This endpoint checks if the user has access to the conversation
 */
export function getAttachmentDownloadUrl(messageId) {
  const headers = getAuthHeaders();
  const guestToken = localStorage.getItem("chat_guest_token") || "";
  
  // Build URL with auth token if available
  let url = `${API}/api/support/messages/${messageId}/attachment/`;
  
  // For guest users, we'll need to pass the token via query param or header
  // The backend will check the X-GUEST-TOKEN header
  return url;
}

/**
 * Get headers for attachment download (includes auth and guest token)
 */
export function getAttachmentDownloadHeaders() {
  const headers = getAuthHeaders();
  const guestToken = localStorage.getItem("chat_guest_token") || "";
  return {
    ...headers,
    "X-GUEST-TOKEN": guestToken,
  };
}

